/*
 * The model layer of AirSS. I handle all the data fatching and idb manipulation
 * The controller layer calls my functions, which are all async to get infos
 * I don't call other layers; If I have something to say I post a custom event
 * to the root document
 */

import {openDB, deleteDB} from './index_db.js';
import * as Feeds from './feeds.js';
import * as Items from './items.js';
import * as Loader from './loader.js';

// events I post to the controller
import {alertEvent, itemsLoadedEvent, shutDownEvent,
	itemUpdatedEvent} from "./airss_controller.js";

// exported client side functions. all return promises or null
export {init, currentState, shutdown, clearData, forwardItem, backwardItem, deleteItem, addFeed,
	refreshItem, unsubscribe, updateItemText, deleteFeed, fetchFeed, updateFeed, allFeedUrls};

/*
 * callback side state and entry points
 */

let db = null;
let loadingOutstanding = false;

async function try_load() {
    // when the cursor is this close to the end I load more
    let waterMark = parseInt(localStorage.getItem("WATER_MARK")) || 10;
    // the minimal elapsed time before a reload, in hour
    let minReloadWait = parseInt(localStorage.getItem("MIN_RELOAD_WAIT")) || 12;

    if (loadingOutstanding)
	return;
    if (Items.unreadCount() > waterMark)
	return;
    let feedId = Feeds.first();
    if (!feedId)
	return;
    let now = new Date();
    let feed = await Feeds.get(db, feedId);
    if (feed.lastLoadTime > now - minReloadWait * 3600 * 1000)
	return;
    Feeds.rotate();
    let items = await Items.allUrlsOfFeed(db, feedId);
    loadingOutstanding = true;
    Loader.load({feed: feed, items: items});
}

// the on demand load callback
async function cb_maybeLoad(prev) {
    await prev;
    await try_load();
}

// the init callback
async function cb_init(prev) {
    await prev;
    db = await openDB("AirSS", 1, (db) => {
 	Feeds.upgrade(db);
	Items.upgrade(db);
    });
    let feedIds = await Feeds.load(db);
    let itemIds = await Items.load(db);
    let item = await Items.getCurrentItem(db);
    itemsLoadedEvent(Items.length(), Items.readingCursor());
    itemUpdatedEvent(item);
    await try_load();
}

// the shutdown callback
async function cb_shutdown(prev, type, msg) {
    await prev;
    if (db) {
	db.close();
	// so database is safe. future db operation will crash
	db = null;
    }
    shutDownEvent(type, msg);
}

async function cb_updateItemText(prev, text, id) {
    await prev;
    let item = await Items.getItem(db, id);
    if (item) {
	item.contentHtml = text;
	await Items.updateItem(db, item);
	if (Items.isCurrentItem(item))
	    itemUpdatedEvent(item);
    }
}

async function cb_clearData(prev) {
    await prev;
    db.close();
    db = null;
    await deleteDB("AirSS");
    shutDownEvent("info", "Database deleted");
}

async function cb_refreshItem(prev) {
    await prev;
    let item = await Items.getCurrentItem(db);
    if (item && !Items.isDummyItem(item)) {
	Loader.reloadUrl(item.url, item.id);
    } else {
	alertEvent("warning", "Item not refreshable");
    }
}

async function cb_forwardItem(prev) {
    await prev;
    let ret = await Items.forward(db);
    if (!ret) {
	alertEvent("warning", "Already at the end");
	await try_load();
    } else {
	itemsLoadedEvent(Items.length(), Items.readingCursor());
	let item = await Items.getCurrentItem(db);
	itemUpdatedEvent(item);
	await try_load();
    }
}

async function cb_backwardItem(prev) {
    await prev;
    let ret = await Items.backward(db);
    if (!ret) {
	alertEvent("warning", "Already at the beginning");
    } else {
	itemsLoadedEvent(Items.length(), Items.readingCursor());
	let item = await Items.getCurrentItem(db);
	itemUpdatedEvent(item);
    }
}

async function cb_deleteItem(prev) {
    await prev;
    await Items.deleteCurrentItem(db);
    itemsLoadedEvent(Items.length(), Items.readingCursor());
    let item = await Items.getCurrentItem(db);
    itemUpdatedEvent(item);
}

async function cb_loadMore(prev) {
    await prev;
    if (shouldLoadMore()) {
	await loadMore();
    }
}

async function cb_unsubscribe(prev, id) {
    await prev;
    await Items.deleteAllItemsOfFeed(db, id);
    try {
	await Feeds.removeFeed(db, id);
	alertEvent("info", "Feed unsubscribed");
    } catch (e) {
	if (e instanceof DOMException) {
	    alertEvent("error", "Feed not found");
	} else {
	    throw e;
	}
    }
    itemsLoadedEvent(Items.length(), Items.readingCursor());
    let item = await Items.getCurrentItem(db);
    itemUpdatedEvent(item);
}

async function cb_addFeed(prev, feed) {
    await prev;
    try {
	let id = await Feeds.addFeed(db, feed);
	console.info("added feed " + feed.feedUrl + " with id: " + id);
    } catch (e) {
	if (e instanceof DOMException) {
	    alertEvent("error", "The feed '" + feed.feedUrl +
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

function oopsItem(feed) {
    let item = new Object();
    item.datePublished = new Date();
    item.contentHtml = "If you see this, this feed '" + feed.feedUrl +
	"' failed loading: Check the console for the detail error.";
    // just fake something to satisfy constrains
    item.url = Math.random().toString(36).substring(2, 15);
    item.title = "Oops...";
    item.tags = ["_error"];
    item.feedTitle = feed.title;
    item.feedId = feed.id;
    return item;
}

function dummyItem(feed) {
    let item = new Object();
    item.datePublished = new Date();
    item.contentHtml = "If you see this, this feed '" + feed.feedUrl +
	"' hasn't been updated since " + feed.lastFetchTime.toString() +
	". There is nothing wrong, just too quiet.";
    // just fake something to satisfy constrains
    item.url = Math.random().toString(36).substring(2, 15);
    item.title = "Errrr...";
    item.tags = ["_error"];
    item.feedTitle = feed.title;
    item.feedId = feed.id;
    return item;
}

async function cb_updateFeed(prev, feed, items) {
    await prev;
    // kept in days
    let maxKeptPeriod = parseInt(localStorage.getItem("MAX_KEPT_PERIOD")) || 180;
    let savedCursor = Items.readingCursor();
    loadingOutstanding = false;
    let oldCount = Items.length();
    let now = new Date();
    if (feed.id === undefined) {
	// must be new feed
	feed.lastLoadTime = now;
	feed.lastFetchTime = now;
	try {
	    let id = await Feeds.addFeed(db, feed);
	    console.info("added feed " + feed.feedUrl + " with id: " + id);
	    alertEvent("info", "The feed '" + feed.feedUrl + "' is now subscribed");
	} catch (e) {
	    if (e instanceof DOMException) {
		alertEvent("error", "The feed '" + feed.feedUrl + "' is already subscribed");
		feed.id = await Feeds.getFeed(db, feed.feedUrl);
	    } else {
		throw e;
	    }
	}
    }
    // push items in reverse order
    for(let i = items.length - 1; i>= 0; i--) {
	let item = items[i];
	item.feedId = feed.id;
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
	alertEvent("error", "The feed '" + feed.feedUrl +
		       "' faild to load");
	console.error("The feed '" + feed.feedUrl +
		       "' faild to load: " + feed.error);
	await Items.pushItem(db, oopsItem(feed));
	delete feed.error;
	num ++;
    } else if (num == 0 &&
	       feed.lastFetchTime < now - maxKeptPeriod*24*3600*1000) {
	console.warn("The feed '" + feed.feedUrl +
		     "' was last fetched at: " + feed.lastFetchTime.toString());
	await Items.pushItem(db, dummyItem(feed));
	num ++;
    }
    // lastLoadTime is the time we attempted to load
    // lastFetchTime is the time we actually loaded something
    feed.lastLoadTime = now;
    if (num > 0) {
	feed.lastFetchTime = now;
	itemsLoadedEvent(Items.length(), Items.readingCursor());
    }
    if (Items.readingCursor() != savedCursor) {
	let item = await Items.getCurrentItem(db);
	itemUpdatedEvent(item);
    }
    await Feeds.updateFeed(db, feed);
    await try_load();
}

async function cb_allFeedUrls(prev) {
    await prev;
    return Feeds.allFeedUrls(db);
}

/*
 * Client side state which is a promise
 * any client side function will await and replace the state
 */
let state = null;

function init() {
    state = cb_init(state);
}

// load feeds if necessary
function maybeLoad() {
    state = cb_maybeLoad(state);
}

// return the current state so client and await me
function currentState() {
    return state;
}

// clear all local data
function clearData() {
    state = cb_clearData(state);
}

// update current item with new text
function refreshItem() {
    state = cb_refreshItem(state);
}

// forward the item cursor.
function forwardItem() {
    state = cb_forwardItem(state);
}

// backward the item cursor.
function backwardItem() {
    state = cb_backwardItem(state);
}

// delete the item under cursor. 
function deleteItem() {
    state = cb_deleteItem(state);
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

// notify item updated
function updateItemText(text, id) {
    state = cb_updateItemText(state, text, id);
}

// update a feed with new data. this is for the callback from load
function updateFeed(feed, items) {
    state = cb_updateFeed(state, feed, items);
}

// return a single feed fetched from the db
function fetchFeed(id) {
    state = cb_fetchFeed(state, id);
    return state;
}

function shutdown(type, msg) {
    state = cb_shutdown(state, type, msg);
    return state;
}

function allFeedUrls() {
    state = cb_allFeedUrls(state);
    return state;
}
