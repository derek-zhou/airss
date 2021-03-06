/*
 * The model layer of AirSS. I handle all the data fatching and idb manipulation
 * The controller layer calls my functions, which are all async to get infos
 * I don't call other layers; If I have something to say I post a custom event
 * to the root document
 */

import {openDB} from 'idb';
import * as Feeds from './feeds.js';
import * as Items from './items.js';
import * as Loader from './loader.js';

// exported client side functions. all return promises or null
export {currentState, reinit, shutdown,
	forwardItem, backwardItem, deleteItem, currentItem,
	subscribe, unsubscribe,
	getLoadCandidate, addFeed, updateFeed};

export {emitModelWarning, emitModelError, emitModelInfo, emitModelItemsLoaded};

// when the cursor is this close to the end I load more
const WaterMark = 10;

// the minimal elapsed time before a reload, in milliseconds
const MinReloadWait = 3600 * 1000;

// events I post to the document from the callback side
function emitModelAlert(type, text) {
    console.log(text);
    window.document.dispatchEvent(new CustomEvent(
	"AirSSModelAlert",
	{detail: {type, text}}
    ));
}

function emitModelWarning(text) {
    emitModelAlert("warning", text);
}

function emitModelError(text) {
    emitModelAlert("error", text);
}

function emitModelInfo(text) {
    emitModelAlert("info", text);
}

function emitModelItemsLoaded(info) {
    window.document.dispatchEvent(new CustomEvent(
	"AirSSModelItemsLoaded",
	{detail: info}
    ));
}

function emitModelInitDone() {
    window.document.dispatchEvent(new Event("AirSSModelInitDone"));
}

function emitModelShutDown() {
    window.document.dispatchEvent(new Event("AirSSModelShutDown"));
}

/*
 * callback side state and entry points
 */

let db = null;

// the shutdown callback
async function cb_shutdown(prev) {
    await prev;
    await db.close();
    // so database is safe. future db operation will crash
    db = null;
    emitModelShutDown();
}

async function cb_currentItem(prev) {
    await prev;
    return Items.getCurrentItem(db);
}

async function cb_forwardItem(prev) {
    await prev;
    if (!Items.forwardCursor()) {
	emitModelWarning("Already at the end");
	return null;
    }
    return Items.getCurrentItem(db);
}

async function cb_backwardItem(prev) {
    await prev;
    if (!Items.backwardCursor()) {
	emitModelWarning("Already at the beginning");
	return null;
    }
    return Items.getCurrentItem(db);
}

async function cb_deleteItem(prev) {
    await prev;
    return Items.deleteCurrentItem(db);
}

async function cb_loadMore(prev) {
    await prev;
    if (shouldLoadMore()) {
	await loadMore();
    }
}

async function cb_markRead(prev) {
    let item = await prev;
    // we know for sure that item is the current item
    if (item)
	await Items.markRead(db, item);
}

async function cb_unsubscribe(prev, id) {
    await prev;
    try {
	await Feeds.removeFeed(db, id);
	emitModelInfo("Feed unsubscribed");
    } catch (e) {
	if (e instanceof DOMException) {
	    emitModelError("Feed not found");
	} else {
	    throw e;
	}
    }
}

async function cb_addFeed(prev, feed) {
    await prev;
    try {
	await Feeds.addFeed(db, feed);
    } catch (e) {
	if (e instanceof DOMException) {
	    emitModelError("The feed '" + feed.feedUrl +
			   "' is already subscribed");
	} else {
	    throw e;
	}
    }
    emitModelInfo("The feed '" + feed.feedUrl + "' is now subscribed");
}

async function cb_updateFeed(prev, feed, items) {
    await prev;
    let oldCount = Items.length();
    // push items in reverse order
    for(let i = items.length - 1; i>= 0; i--) {
	try {
	    await Items.pushItem(db, items[i]);
	} catch(e) {
	    if (e instanceof DOMException) {
		// it is common that an item cannot be add
	    } else {
		throw e;
	    }
	}
    }
    let num = Items.length() - oldCount;
    console.log("loading feed '" + feed.feedUrl + "' with " + num + " items");
    await Feeds.updateFeed(db, feed);
    if (num > 0)
	emitModelItemsLoaded({
	    length: Items.length(),
	    cursor: Items.readingCursor()
	});
    else
	Loader.load();
}

async function cb_getLoadCandidate(prev) {
    await prev;
    let feedId = Feeds.first();
    if (!feedId || Items.unreadCount() >= WaterMark)
	return null;
    let now = new Date();
    let feed = await Feeds.get(db, feedId);
    if (feed.lastLoadTime > now - MinReloadWait)
	return null;
    return feed;
}

/*
 * internal functions of the callback side
 */
async function init() {
    db = await openDB("AirSS", 1, {
	upgrade(db) {
 	    Feeds.upgrade(db);
	    Items.upgrade(db);
	},
    });
    await Feeds.load(db);
    await Items.load(db);
    emitModelItemsLoaded({
	length: Items.length(),
	cursor: Items.readingCursor()
    });
    emitModelInitDone();
}

/*
 * Client side state which is a promise
 * any client side function will await and replace the state
 */
let state = init();

// return the current state so client and await me
function currentState() {
    return state;
}

// reinit the model layer. return a promise that resolve to null
// when everything initialized.
function reinit() {
    state = cb_reinit(state);
    return state;
}

// forward the item cursor. return a promise that resolve to a item
// to display, or null if nothing changed
function forwardItem() {
    let value = state = cb_forwardItem(state);
    // to piggy back marking and loading here
    state = cb_markRead(state);
    Loader.load();
    return value;
}

// backward the item cursor. return a promise that resolve to a item
// to display or null if nothing changed
function backwardItem() {
    state = cb_backwardItem(state);
    return state;
}

// delete the item under cursor. 
// return a promise that resolve to true/false
function deleteItem() {
    state = cb_deleteItem(state);
    return state;
}

// just load the current item, if any
function currentItem() {
    let value = state = cb_currentItem(state);
    Loader.load();
    return value;
}

// subscribe to a feed url
function subscribe(url) {
    Loader.subscribe(url);
}

// unsubscribe a feed by id
function unsubscribe(id) {
    state = cb_unsubscribe(state, id);
}

// add a feed. this is for the callback from subscribe
function addFeed(feed) {
    state = cb_addFeed(state, feed);
}

// update a feed with new data. this is for the callback from load
function updateFeed(feed, items) {
    state = cb_updateFeed(state, feed, items);
}

// return a feed to load, or null if no such candidate is found
function getLoadCandidate() {
    state = cb_getLoadCandidate(state);
    return state;
}

function shutdown() {
    state = cb_shutdown(state);
    return state;
}
