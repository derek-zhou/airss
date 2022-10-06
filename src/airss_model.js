/*
 * The model layer of AirSS. I handle all the data fatching and idb manipulation
 * The controller layer calls my functions, which are all async to get infos
 * I don't call other layers; If I have something to say I post a custom event
 * to the root document
 */

import {openDB, deleteDB} from 'idb';
import * as Feeds from './feeds.js';
import * as Items from './items.js';
import * as Loader from './loader.js';

// exported client side functions. all return promises or null
export {currentState, shutdown, clearData, warn, error,
	forwardItem, backwardItem, deleteItem, currentItem, refreshItem,
	subscribe, unsubscribe, loadingStart, loadingDone, updateItemText,
	getLoadCandidate, addFeed, deleteFeed, addItems, fetchFeed, updateFeed};

// when the cursor is this close to the end I load more
const WaterMark = localStorage.getItem("WATER_MARK") || 10;

// the minimal elapsed time before a reload, in hour
const MinReloadWait = localStorage.getItem("MIN_RELOAD_WAIT") || 12;

// kept in days
const MaxKeptPeriod = localStorage.getItem("MAX_KEPT_PERIOD") || 180;

// events I post to the document from the callback side
function emitModelAlert(type, text) {
    window.document.dispatchEvent(new CustomEvent(
	"AirSSModelAlert",
	{detail: {type, text}}
    ));
}

function emitModelWarning(text) {
    console.warn(text);
    emitModelAlert("warning", text);
}

function emitModelError(text) {
    console.error(text);
    emitModelAlert("error", text);
}

function emitModelInfo(text) {
    console.info(text);
    emitModelAlert("info", text);
}

function emitModelItemsLoaded(info) {
    console.info("Items loaded. cursor at: " + info.cursor +
		" length: " + info.length);
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

function emitModelStartLoading() {
    window.document.dispatchEvent(new Event("AirSSModelStartLoading"));
}

function emitModelStopLoading() {
    window.document.dispatchEvent(new Event("AirSSModelStopLoading"));
}

function emitModelItemUpdated(item) {
    window.document.dispatchEvent(new CustomEvent("AirSSModelItemUpdated", {detail: item}));
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

async function cb_warn(prev, msg) {
    await prev;
    emitModelWarning(msg);
}

async function cb_loadingStart(prev) {
    await prev;
    emitModelStartLoading();
}

async function cb_loadingDone(prev) {
    await prev;
    emitModelStopLoading();
}

async function cb_updateItemText(prev, text, id) {
    await prev;
    let item = await Items.getItem(db, id);
    if (item) {
	item.contentHtml = text;
	await Items.updateItem(db, item);
	if (Items.isCurrentItem(item))
	    emitModelItemUpdated(item);
    }
}

async function cb_error(prev, msg) {
    await prev;
    emitModelError(msg);
}

async function cb_clearData(prev) {
    await prev;
    console.info("deleting database");
    await db.close();
    await deleteDB("AirSS");
    console.info("database deleted");
    db = null;
}

async function cb_subscribe(prev, url) {
    await prev;
    // we have to make sure init is done
    Loader.subscribe(url);
}

async function cb_refreshItem(prev) {
    await prev;
    let item = await Items.getCurrentItem(db);
    if (!item || Items.isDummyItem(item))
	return null;
    Loader.reloadUrl(item.url, item.id);
}

async function cb_currentItem(prev) {
    await prev;
    let item = await Items.getCurrentItem(db);
    Loader.load();
    return item;
}

async function cb_forwardItem(prev) {
    await prev;
    if (!Items.forwardCursor()) {
	emitModelWarning("Already at the end");
	return null;
    }
    let item = await Items.getCurrentItem(db);
    Loader.load();
    return item;
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
    await Items.deleteCurrentItem(db);
    // forward can fail, but it is ok
    Items.forwardCursor();
    emitModelItemsLoaded({
	length: Items.length(),
	cursor: Items.readingCursor()
    });
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
    await Items.deleteAllItemsOfFeed(db, id);
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
    emitModelItemsLoaded({
	length: Items.length(),
	cursor: Items.readingCursor()
    });
}

async function cb_addFeed(prev, feed) {
    await prev;
    try {
	let id = await Feeds.addFeed(db, feed);
	console.info("added feed " + feed.feedUrl + " with id: " + id);
    } catch (e) {
	if (e instanceof DOMException) {
	    emitModelError("The feed '" + feed.feedUrl +
			   "' is already subscribed");
	} else {
	    throw e;
	}
    }
}

async function cb_deleteFeed(prev, id) {
    await prev;
    return Feeds.deleteFeed(db, id);
}

async function cb_fetchFeed(prev, id) {
    await prev;
    return Feeds.get(db, id);
}

async function cb_addItems(prev, items) {
    await prev;
    let cnt = 0;
    for (let item of items.values()) {
	try {
	    await Items.addItem(db, item);
	    cnt ++;
	} catch (e) {
	    if (e instanceof DOMException) {
		// it is common that an item cannot be add
	    } else {
		throw e;
	    }
	}
    }
    if (cnt > 0) {
	emitModelItemsLoaded({
	    length: Items.length(),
	    cursor: Items.readingCursor()
	});
    }
}

function oopsItem(feed, id) {
    let item = new Object();
    item.datePublished = new Date();
    item.contentHtml = "If you see this, this feed '" + feed.feedUrl +
	"' failed loading:" +
	"Check the console for the detail error.";
    // just fake something to satisfy constrains
    item.url = Math.random().toString(36).substring(2, 15);
    item.title = "Oops...";
    item.tags = ["_error"];
    item.feedTitle = feed.title;
    item.feedId = id;
    return item;
}

function dummyItem(feed, id) {
    let item = new Object();
    item.datePublished = new Date();
    item.contentHtml = "If you see this, this feed '" + feed.feedUrl +
	"' hasn't been updated for " + MaxKeptPeriod +
	" days. There is nothing wrong, just too quiet.";
    // just fake something to satisfy constrains
    item.url = Math.random().toString(36).substring(2, 15);
    item.title = "Errrr...";
    item.tags = ["_error"];
    item.feedTitle = feed.title;
    item.feedId = id;
    return item;
}

async function cb_updateFeed(prev, feed, items) {
    await prev;
    let oldCount = Items.length();
    let now = new Date();
    let feedId;
    if (feed.id === undefined) {
	// must be new feed
	try {
	    let id = await Feeds.addFeed(db, feed);
	    console.info("added feed " + feed.feedUrl + " with id: " + id);
	    emitModelInfo("The feed '" + feed.feedUrl + "' is now subscribed");
	    feedId = id;
	} catch (e) {
	    if (e instanceof DOMException) {
		emitModelError("The feed '" + feed.feedUrl + "' is already subscribed");
		return;
	    } else {
		throw e;
	    }
	}
    } else {
	feedId = feed.id;
    }
    // push items in reverse order
    for(let i = items.length - 1; i>= 0; i--) {
	let item = items[i];
	item.feedId = feedId;
	try {
	    await Items.pushItem(db, item);
	} catch(e) {
	    if (e instanceof DOMException) {
		// it is common that an item cannot be add
	    } else {
		throw e;
	    }
	}
    }
    let num = Items.length() - oldCount;
    console.info("loaded feed '" + feed.feedUrl + "' with " + num + " of " + items.length + " items");

    if (feed.error) {
	emitModelError("The feed '" + feed.feedUrl +
		       "' faild to load");
	console.error("The feed '" + feed.feedUrl +
		       "' faild to load: " + feed.error);
	await Items.pushItem(db, oopsItem(feed, feedId));
	delete feed.error;
	num ++;
    } else if (num == 0 &&
	       feed.lastFetchTime < now - MaxKeptPeriod*24*3600*1000) {
	await Items.pushItem(db, dummyItem(feed, feedId));
	num ++;
    }
    // lastLoadTime is the time we attempted to load
    // lastFetchTime is the time we actually loaded something
    feed.lastLoadTime = now;
    if (num > 0) {
	feed.lastFetchTime = now;
	emitModelItemsLoaded({
	    length: Items.length(),
	    cursor: Items.readingCursor()
	});
    }
    await Feeds.updateFeed(db, feed);
    Loader.load();
}

async function cb_getLoadCandidate(prev) {
    await prev;
    if (Items.unreadCount() >= WaterMark)
	return null;
    let feedId = Feeds.first();
    if (!feedId)
	return null;
    let now = new Date();
    let feed = await Feeds.get(db, feedId);
    if (feed.lastLoadTime > now - MinReloadWait * 3600 * 1000)
	return null;
    Feeds.rotate();
    let items = await Items.allUrlsOfFeed(db, feedId);
    return {feed: feed, items: items};
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
    let feedIds = await Feeds.load(db);
    let itemIds = await Items.load(db);
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

// clear all local data. return a promise that resolve to null
// when everything initialized.
function clearData() {
    state = cb_clearData(state);
    return state;
}

// print a warning
function warn(msg) {
    state = cb_warn(state, msg);
    return state;
}

// print a error
function error(msg) {
    state = cb_error(state, msg);
    return state;
}

// update current item with new text
function refreshItem() {
    state = cb_refreshItem(state);
    return state;
}

// forward the item cursor. return a promise that resolve to a item
// to display, or null if nothing changed
function forwardItem() {
    let value = state = cb_forwardItem(state);
    // to piggy back marking and loading here
    state = cb_markRead(state);
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
    return value;
}

// subscribe to a feed url
function subscribe(url) {
    state = cb_subscribe(state, url);
    return state;
}

// unsubscribe a feed by id
function unsubscribe(id) {
    state = cb_unsubscribe(state, id);
}

// add a feed. this is for the callback from subscribe
function addFeed(feed) {
    state = cb_addFeed(state, feed);
}

// delete a feed by id
function deleteFeed(id) {
    state = cb_deleteFeed(state, id);
}

// notify loading started
function loadingStart() {
    state = cb_loadingStart(state);
}

// notify loading is done
function loadingDone() {
    state = cb_loadingDone(state);
}

// notify item updated
function updateItemText(text, id) {
    state = cb_updateItemText(state, text, id);
}

// add a item
function addItems(items) {
    state = cb_addItems(state, items);
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

// return a single feed fetched from the db
function fetchFeed(id) {
    state = cb_fetchFeed(state, id);
    return state;
}

function shutdown() {
    state = cb_shutdown(state);
    return state;
}
