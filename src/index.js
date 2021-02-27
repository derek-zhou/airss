import App from './App.svelte';

const app = new App({
    target: document.body,
    props: {
	// assuming App.svelte contains something like
	// `export let answer`:
	name: "Derek Zhou"
    }
});
