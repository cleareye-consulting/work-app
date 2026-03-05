<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Button from '../../../components/Button.svelte';
	import Input from '../../../components/Input.svelte';
</script>

<ContentHeader>New Client</ContentHeader>

<form method="POST">
	<div>
		<Input name="name" required>Name</Input>
	</div>
	<div>
		<Input name="billingStartDayOfMonth" type="number" min="1" max="28">Billing Start Day (1-28)</Input>
	</div>
	<div>
		<Button>Create</Button>
	</div>
</form>