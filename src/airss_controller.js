/*
 * The controller layer of AirSS.
 * The model layer also send events and change variables as the roots of reactivity
 * The model founctions are encapsulated for use by the view layer
 */

import * as Model from './airss_model.js';
import { createSignal, batch } from "solid-js";
import topbar from 'topbar';

// timeout for the model to shutdown itself for inactivity
const TimeoutPeriod = 3600 * 1000;

// watchdog to shutdown the backend when idel long enough
let idleTimeout = setTimeout(timeoutShutdown, TimeoutPeriod);

// module layer driven signals
const [length, setLength] = createSignal(0);
const [cursor, setCursor] = createSignal(-1);
const [currentItem, setCurrentItem] = createSignal(null);
const [running, setRunning] = createSignal(true);
const [postHandle, setPostHandle] = createSignal("");

// only the getters are exported
export {length, cursor, currentItem, running, postHandle};

// screen is fundimental content shown in the window
export const Screens = {
    browse: 1,
    shuutdown: 2,
    subscribe: 3,
    trash: 4,
    config: 5
};

// read write signals for user interactions
export const [screen, setScreen] = createSignal(Screens.browse);
export const [unsubscribeDefault, setUnsubscribeDefault] = createSignal(false);
export const [alertText, setAlertText] = createSignal("");
export const [alertType, setAlertType] = createSignal("info");

function actionPreamble() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(timeoutShutdown, TimeoutPeriod);
    setAlertText("");
}

// shutdown the model layer. return a promise that reject
// when everything shutdown
function timeoutShutdown() {
    actionPreamble();
    clearTimeout(idleTimeout);
    batch(() => {
	setAlertType("error");
	setAlertText("Shutdown due to inactivity");
    });
    return Model.shutdown();
}

async function loadCurrentItem() {
    let item = await Model.currentItem();
    if (item)
	setCurrentItem(item);
}

export async function forwardItem() {
    actionPreamble();
    let item = await Model.forwardItem();
    if (item) {
	batch(() => {
	    setCursor(cursor() + 1);
	    setCurrentItem(item);
	});
    }
}

export async function refreshItem() {
    actionPreamble();
    Model.refreshItem();
}

export async function backwardItem() {
    actionPreamble();
    let item = await Model.backwardItem();
    if (item) {
	batch(() => {
	    setCursor(cursor() - 1);
	    setCurrentItem(item);
	});
    }
}

export async function deleteItem() {
    actionPreamble();
    await Model.deleteItem();
    setCurrentItem(await Model.currentItem());
}

export function clearData() {
    actionPreamble();
    return Model.clearData();
}

export async function unsubscribe(id) {
    actionPreamble();
    await Model.unsubscribe(id);
    setCurrentItem(await Model.currentItem());
}

export function subscribe(url) {
    actionPreamble();
    Model.subscribe(url);
}

export function saveFeeds() {
    actionPreamble();
    Model.saveFeeds();
}

export function restoreFeeds(handle) {
    actionPreamble();
    Model.restoreFeeds(handle);
}

document.addEventListener("AirSSModelItemsLoaded", e => {
    batch(() => {
	setLength(e.detail.length);
	setCursor(e.detail.cursor);
    });
    if (e.detail.length > 0 && e.detail.cursor == -1)
	forwardItem();
});

document.addEventListener("AirSSModelAlert", e => {
    batch(() => {
	alertType(e.detail.type);
	alertText(e.detail.text);
    });
});

document.addEventListener("AirSSModelShutDown", () => {
    setRunning(false);
});

document.addEventListener("AirSSModelPostHandle", e => {
    setPostHandle(e.detail.text);
});

document.addEventListener("AirSSModelItemUpdated", e => {
    setCurrentItem(e.detail);
});

document.addEventListener("AirSSModelStartLoading", () => {
    topbar.show();
});

document.addEventListener("AirSSModelStopLoading", () => {
    topbar.hide();
});

document.addEventListener("AirSSModelInitDone", () => {
    // do I have a incoming api call to subscribe a feed
    if (location.search) {
	let params = new URLSearchParams(location.search.substring(1));
	let str = params.get("url");
	// do I have a refer so I can subscribe?
	if (params.has("subscribe-referrer") && document.referrer)
	    Model.subscribe(document.referrer);
	else if (str)
	    Model.subscribe(decodeURIComponent(str));
    }
    loadCurrentItem();
});
