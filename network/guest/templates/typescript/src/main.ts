type CounterState = {
	value: number;
};

const state: CounterState = { value: 0 };
const button = document.querySelector<HTMLButtonElement>('#counter');

function render(): void {
	if (button) button.textContent = `Count: ${state.value}`;
}

button?.addEventListener('click', () => {
	state.value += 1;
	render();
});

render();
