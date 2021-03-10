/*
 * The controller layer of AirSS.
 * I export stores for the svelte view to consume;
 * I export functions for the svelte view on actions
 * I handle model emited events
 */

import * as Model from './airss_model.js';
import { writable } from 'svelte/store';

export const length = writable(0);
export const cursor = writable(-1);
export const alertText = writable("");
export const alertClass = writable("alert-info");
export const currentItem = writable(null);
export const running = writable(true);

export async function forwardItem() {
    let item = await Model.forwardItem();
    if (item) {
	cursor.update(n => n + 1);
	currentItem.set(item);
    }
}

export async function backwardItem() {
    let item = await Model.backwardItem();
    if (item) {
	cursor.update(n => n - 1);
	currentItem.set(item);
    }
}

export function unsubscribe(id) {
    Model.unsubscribe(id);
}

export function subscribe(url) {
    Model.subscribe(url);
}

document.addEventListener("AirSSModelItemsLoaded", info => {
    length.set(info.length);
    cursor.set(info.cursor);
    if (info.length > 0 && info.cursor == -1)
	forwardItem();
});
document.addEventListener("AirSSModelAlert", info => {
    alertClass.set("alert-" + info.type);
    alertText.set(info.text);
});

document.addEventListener("AirSSModelShutDown", () => {
    running.set(false);
});

