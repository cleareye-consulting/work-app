import os
import sys
import json
import re
import psycopg2
from psycopg2.extras import Json, execute_batch

def unwrap(val):
    """Recursively unwraps DynamoDB typed JSON (e.g., {'S': 'value'}) to standard Python types."""
    if not isinstance(val, dict):
        return val
    if 'S' in val: return val['S']
    if 'N' in val:
        n = val['N']
        return int(n) if '.' not in n else float(n)
    if 'BOOL' in val: return val['BOOL']
    if 'M' in val: return {k: unwrap(v) for k, v in val['M'].items()}
    if 'L' in val: return [unwrap(v) for v in val['L']]
    if 'NULL' in val: return None
    # Fallback for already unwrapped values or unknown formats
    return val

def migrate(file_path, conn_string):
    """Main migration function."""
    patterns = [
        {"table": "clients", "pk": r"^CLIENT#(?P<id>\d+)$", "sk": r"^METADATA$"},
        {"table": "client_documents", "pk": r"^CLIENT#(?P<client_id>\d+)$", "sk": r"^DOC#(?:\d+)$"},
        {"table": "client_summaries", "pk": r"^CLIENT#(?P<client_id>\d+)$", "sk": r"^SUM#(?P<created_at>.+)$"},
        {"table": "work_items", "pk": r"^WI#(?P<id>\d+)$", "sk": r"^METADATA$"},
        {"table": "work_item_documents", "pk": r"^WI#(?P<work_item_id>\d+)$", "sk": r"^DOC#(?:\d+)$"},
        {"table": "work_item_changes", "pk": r"^WI#(?P<work_item_id>\d+)$", "sk": r"^EVT#(?P<created_at>.+)$"},
        {"table": "time_entries", "pk": r"^TIME#(?:\d+)$", "sk": r"^WI#(?P<work_item_id>\d+)$"},
    ]

    try:
        if not os.path.exists(file_path):
            print(f"Error: {file_path} not found.")
            return

        with open(file_path, 'r') as f:
            data = json.load(f)
        
        items = data.get('Items', data) if isinstance(data, dict) else data
        table_records = {p['table']: [] for p in patterns}
        
        print(f"Analyzing {len(items)} items from {file_path}...")
        
        for item in items:
            pk = item.get('PK', {}).get('S', '')
            sk = item.get('SK', {}).get('S', '')
            
            for p in patterns:
                pk_match = re.match(p['pk'], pk)
                sk_match = re.match(p['sk'], sk)
                
                if pk_match and sk_match:
                    # Unwrap all attributes
                    record = {k: unwrap(v) for k, v in item.items() if k not in ('PK', 'SK')}
                    
                    # Map camelCase to snake_case if necessary
                    mapping = {
                        'billingStartDayOfMonth': 'billing_start_day_of_month',
                        'isActive': 'is_active',
                        'createdAt': 'created_at',
                        'updatedAt': 'updated_at',
                        'workItemType': 'work_item_type',
                        'parentId': 'parent_id',
                        'clientId': 'client_id',
                        'workItemId': 'work_item_id',
                        'customFields': 'custom_fields',
                        'contentType': 'content_type',
                        'startTime': 'start_time',
                        'endTime': 'end_time',
                        'summaryOfChanges': 'summary_of_changes',
                        'summary': 'summary',
                        'content': 'content'
                    }
                    
                    # Handle 'type' field which maps differently depending on the table
                    if 'type' in record:
                        if p['table'] in ('client_documents', 'work_item_documents'):
                            record['content_type'] = record.pop('type')
                        elif p['table'] == 'work_items':
                            record['work_item_type'] = record.pop('type')
                        else:
                            pass

                    # Special handling for summary_of_changes in work_item_changes
                    if p['table'] == 'work_item_changes' and 'content' in record:
                        record['summary_of_changes'] = record.get('content')

                    for old_k, new_k in mapping.items():
                        if old_k in record:
                            val = record.pop(old_k)
                            # Avoid overwriting if snake_case already exists
                            if new_k not in record or record[new_k] is None:
                                record[new_k] = val
                            # Special case: if we just popped 'content' but we are 'client_documents'
                            # we want to make sure 'content' (the new_k) is set correctly.
                            # Actually record[new_k] = val handles it if it was None.

                    # Fallback for summary in documents if still missing
                    if p['table'] in ('client_documents', 'work_item_documents'):
                        if 'summary' not in record or record['summary'] is None:
                            record['summary'] = record.get('name', '') # Better than nothing

                    # Merge IDs/values extracted from PK/SK
                    extracted = {**pk_match.groupdict(), **sk_match.groupdict()}
                    for k, v in extracted.items():
                        # Prioritize attributes if present, otherwise use SK/PK value
                        if k not in record or record[k] is None:
                            record[k] = v

                    # Fallback for missing timestamps
                    if 'created_at' in record and ('updated_at' not in record or record['updated_at'] is None):
                        record['updated_at'] = record['created_at']
                    elif 'updated_at' in record and ('created_at' not in record or record['created_at'] is None):
                        record['created_at'] = record['updated_at']
                    
                    # Last resort fallback for all tables (Postgres schema has NOT NULL)
                    from datetime import datetime
                    now = datetime.now().isoformat()
                    if 'created_at' not in record or record['created_at'] is None:
                        # Try start_time as a fallback for time_entries
                        record['created_at'] = record.get('start_time', now)
                    if 'updated_at' not in record or record['updated_at'] is None:
                        record['updated_at'] = record.get('created_at', now)
                    
                    # Common Type conversions for numeric IDs
                    for key in ['id', 'client_id', 'work_item_id', 'parent_id', 'billing_start_day_of_month']:
                        if key in record and record[key] is not None:
                            try:
                                record[key] = int(record[key])
                            except (ValueError, TypeError):
                                pass
                    
                    # Boolean normalization for clients
                    if 'is_active' in record:
                        val = record['is_active']
                        if isinstance(val, str):
                            record['is_active'] = val.lower() in ('true', '1', 'yes', 't')
                        elif isinstance(val, (int, float)):
                            record['is_active'] = bool(val)

                    table_records[p['table']].append(record)
                    break
        
        if not conn_string:
            print("\n--- Dry Run Results ---")
            for table, recs in table_records.items():
                print(f"Found {len(recs):>4} records for table: {table}")
            print("\nNo connection string provided. Provide a PostgreSQL URL to execute the migration.")
            print("Usage: python3 migrate.py <dump_path> <postgres_url>")
            print("   or: DATABASE_URL=<postgres_url> python3 migrate.py")
            return

        print(f"Connecting to database...")
        conn = psycopg2.connect(conn_string)
        cur = conn.cursor()
        
        try:
            # 1. clients
            print("Importing clients...")
            insert_clients(cur, table_records["clients"])
            
            # 2. work_items (2-pass to handle self-referencing parent_id FK)
            print("Importing work items...")
            insert_work_items(cur, table_records["work_items"])

            # 3. Other tables (independent)
            print("Importing related documents and logs...")
            insert_client_documents(cur, table_records["client_documents"])
            insert_client_summaries(cur, table_records["client_summaries"])
            insert_work_item_documents(cur, table_records["work_item_documents"])
            insert_work_item_changes(cur, table_records["work_item_changes"])
            insert_time_entries(cur, table_records["time_entries"])

            # 4. Synchronize Identity Sequences
            print("Synchronizing primary key sequences...")
            cur.execute("SELECT setval(pg_get_serial_sequence('clients', 'id'), coalesce(max(id), 1)) FROM clients")
            cur.execute("SELECT setval(pg_get_serial_sequence('work_items', 'id'), coalesce(max(id), 1)) FROM work_items")
            
            conn.commit()
            print("\nMigration successful!")
            for table, recs in table_records.items():
                print(f" -> {len(recs):>4} records imported into {table}")
                
        except Exception as e:
            conn.rollback()
            print(f"\nError during migration: {e}")
            raise
        finally:
            cur.close()
            conn.close()

    except Exception as e:
        print(f"\nFailed to process: {e}")

def insert_clients(cur, records):
    """Inserts records into clients table."""
    if not records:
        return
    columns = ["id", "name", "billing_start_day_of_month", "is_active", "created_at", "updated_at"]
    args = [tuple(r.get(col) for col in columns) for r in records]
    sql = "INSERT INTO clients (id, name, billing_start_day_of_month, is_active, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s)"
    execute_batch(cur, sql, args)

def insert_work_items(cur, records):
    """Inserts records into work_items table using a 2-pass strategy for self-references."""
    if not records:
        return
    columns = ["id", "name", "work_item_type", "status", "description", "client_id", "parent_id", "custom_fields", "created_at", "updated_at"]
    
    # Pass 1: Insert all with parent_id = None
    args_pass1 = []
    for r in records:
        row = []
        for col in columns:
            if col == 'parent_id':
                row.append(None)
            elif col == 'custom_fields' and r.get(col) is not None:
                row.append(Json(r.get(col)))
            else:
                row.append(r.get(col))
        args_pass1.append(tuple(row))
    
    sql_insert = "INSERT INTO work_items (id, name, work_item_type, status, description, client_id, parent_id, custom_fields, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
    execute_batch(cur, sql_insert, args_pass1)
    
    # Pass 2: Update real parent_id values
    updates = [(r.get('parent_id'), r.get('id')) for r in records if r.get('parent_id')]
    if updates:
        print(f"Updating work item parent references ({len(updates)} updates)...")
        execute_batch(cur, "UPDATE work_items SET parent_id = %s WHERE id = %s", updates)

def insert_client_documents(cur, records):
    """Inserts records into client_documents table."""
    if not records:
        return
    columns = ["client_id", "name", "content_type", "content", "summary", "created_at", "updated_at"]
    args = [tuple(r.get(col) for col in columns) for r in records]
    sql = "INSERT INTO client_documents (client_id, name, content_type, content, summary, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s)"
    execute_batch(cur, sql, args)

def insert_client_summaries(cur, records):
    """Inserts records into client_summaries table."""
    if not records:
        return
    columns = ["client_id", "content", "created_at", "updated_at"]
    args = [tuple(r.get(col) for col in columns) for r in records]
    sql = "INSERT INTO client_summaries (client_id, content, created_at, updated_at) VALUES (%s, %s, %s, %s)"
    execute_batch(cur, sql, args)

def insert_work_item_documents(cur, records):
    """Inserts records into work_item_documents table."""
    if not records:
        return
    columns = ["work_item_id", "name", "content_type", "content", "summary", "created_at", "updated_at"]
    args = [tuple(r.get(col) for col in columns) for r in records]
    sql = "INSERT INTO work_item_documents (work_item_id, name, content_type, content, summary, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s)"
    execute_batch(cur, sql, args)

def insert_work_item_changes(cur, records):
    """Inserts records into work_item_changes table."""
    if not records:
        return
    columns = ["work_item_id", "summary_of_changes", "created_at", "updated_at"]
    args = [tuple(r.get(col) for col in columns) for r in records]
    sql = "INSERT INTO work_item_changes (work_item_id, summary_of_changes, created_at, updated_at) VALUES (%s, %s, %s, %s)"
    execute_batch(cur, sql, args)

def insert_time_entries(cur, records):
    """Inserts records into time_entries table."""
    if not records:
        return
    columns = ["work_item_id", "start_time", "end_time", "created_at", "updated_at"]
    args = [tuple(r.get(col) for col in columns) for r in records]
    sql = "INSERT INTO time_entries (work_item_id, start_time, end_time, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)"
    execute_batch(cur, sql, args)

if __name__ == "__main__":
    # Determine default paths
    default_dump = "dump.json" if os.path.exists("dump.json") else "../dump.json"
    
    path = default_dump
    conn_str = os.environ.get('DATABASE_URL')
    
    # Simple argument parsing
    if len(sys.argv) > 1:
        arg1 = sys.argv[1]
        # Check if first arg looks like a connection string
        if arg1.startswith("postgresql://") or "dbname=" in arg1:
            conn_str = arg1
        else:
            path = arg1
            if len(sys.argv) > 2:
                conn_str = sys.argv[2]
                
    migrate(path, conn_str)
