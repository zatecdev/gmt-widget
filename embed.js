import Embed from './Embed.svelte';
import Widget from './Widget.svelte';

const div = document.createElement('div');
const script = document.currentScript;
script.parentNode.insertBefore(div, script);

let customerId = document.currentScript.getAttribute('data-customer-id');

//can use this id to make other request to get the tree numbers etc.
// const embed = new Embed({
//     target: div,
//     props: { customerId: customerId},
// });

const widget = new Widget({
    target: div,
    props: { customerId: customerId},
});