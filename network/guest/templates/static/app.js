const button = document.getElementById('ping');
const out = document.getElementById('out');

let count = 0;
button.addEventListener('click', () => {
	count += 1;
	const times = count === 1 ? 'once' : `${count} times`;
	out.textContent = `Hello from the guest — clicked ${times}.`;
});
