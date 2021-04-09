/*
 * The controller layer of AirSS.
 * I export stores for the svelte view to consume;
 * I export functions for the svelte view on actions
 * I handle model emited events
 */

import * as Model from './airss_model.js';
import { writable } from 'svelte/store';

// timeout for the model to shutdown itself for inactivity
const TimeoutPeriod = 600 * 1000;

// watchdog to shutdown the backend when idel long enough
let idleTimeout = setTimeout(timeoutShutdown, TimeoutPeriod);

export const length = writable(0);
export const cursor = writable(-1);
export const alertText = writable("");
export const alertType = writable("info");
export const currentItem = writable(null);
export const running = writable(true);

function actionPreamble() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(timeoutShutdown, TimeoutPeriod);
    alertText.set("");
}

// shutdown the model layer. return a promise that reject
// when everything shutdown
function timeoutShutdown() {
    actionPreamble();
    clearTimeout(idleTimeout);
    alertType.set("error");
    alertText.set("Shutdown due to inactivity");
    return Model.shutdown();
}

async function loadCurrentItem() {
    let item = await Model.currentItem();
    if (item)
	currentItem.set(item);
}

export async function forwardItem() {
    actionPreamble();
    let item = await Model.forwardItem();
    if (item) {
	cursor.update(n => n + 1);
	currentItem.set(item);
    }
}

export async function backwardItem() {
    actionPreamble();
    let item = await Model.backwardItem();
    if (item) {
	cursor.update(n => n - 1);
	currentItem.set(item);
    }
}

export async function deleteItem() {
    actionPreamble();
    if (await Model.deleteItem()) {
	length.update(n => n - 1);
	cursor.update(n => n - 1);
 	currentItem.set(await Model.currentItem());
    }
}

export function unsubscribe(id) {
    actionPreamble();
    Model.unsubscribe(id);
}

export function subscribe(url) {
    actionPreamble();
    Model.subscribe(url);
}

document.addEventListener("AirSSModelItemsLoaded", e => {
    length.set(e.detail.length);
    cursor.set(e.detail.cursor);
});
document.addEventListener("AirSSModelAlert", e => {
    alertType.set(e.detail.type);
    alertText.set(e.detail.text);
});

document.addEventListener("AirSSModelShutDown", () => {
    running.set(false);
});

document.addEventListener("AirSSModelInitDone", () => {
    // do I have a incoming api call to subscribe a feed
    if (location.search) {
	let params = new URLSearchParams(location.search.substring(1));
	let str = params.get("url");
	// do I have a refer so I can subscribe?
	if (params.has("subscribe-referrer") && document.referrer)
	    Model.subscribe(document.referrer);
	if (str)
	    Model.subscribe(decodeURIComponent(str));
    }
    loadCurrentItem();
});
