/*
 * wrap airtable operation in a seperate server.
 */

import Airtable from 'airtable';

export {loadFeedsBeyond, upsertFeed, deleteFeed};
export {loadItemsBeyond, markRead, addItem, deleteItem};

const ApiKey = localStorage.getItem('AIRTABLE_API_KEY');
const BaseToken = localStorage.getItem('AIRTABLE_BASE_TOKEN');

// table names
const FeedsTable = "feeds";
const ItemsTable = "items";

const FeedType = {
    json: 1,
    xml: 2
}

/*
 * callback states
 */

let base = null;

// keep track of keys in airtable
let feedsKeyMap = new Map();
let itemsKeyMap = new Map();

/*
 * callback functions
 */

async function cb_loadFeedsBeyond(prev, min) {
    await prev;
    if (base === null)
	return [];
    let feeds = await base(FeedsTable).select({
	filterByFormula: "id > " + min,
	sort: [{field: "id"}]
    }).firstPage();

    let rets = [];
    for (let each of feeds.values()) {
	feedsKeyMap.set(each.get("id"), each.getId());
	rets.push({
	    id: each.get("id"),
	    feedUrl: each.get("feedUrl"),
	    lastLoadTime: each.get("lastLoadTime") * 1000,
	    type: feedType(each.get("type")),
	    title: each.get("title") || "",
	    homePageUrl: each.get("homePageUrl") || ""
	});
    }
    return rets;
}

async function cb_upsertFeed(prev, feed) {
    await prev;
    if (base === null)
	return feed.id;
    let key = await getFeedKey(id);
    if (key === undefined) {
	let record = await base(FeedsTable).create({
	    id: feed.id,
	    feedUrl: feed.feedUrl,
	    lastLoadTime: Math.floor(feed.lastLoadTime / 1000),
	    type: feedTypeStr(feed.type),
	    title: feed.title || "",
	    homePageUrl: feed.homePageUrl || ""
	});
	feedsKeyMap.set(feed.id, record.getId());
    } else {
	// we do not update every field
	let patch = new Object();
	if (feed.title !== undefined)
	    patch.title = feed.title;
	if (feed.lastLoadTime !== undefined)
	    patch.lastLoadTime = Math.floor(feed.lastLoadTime / 1000);
	if (feed.homePageUrl !== undefined)
	    patch.homePageUrl = feed.homePageUrl;
	await base(FeedsTable).update(key, patch);
    }
    return feed.id;
}

async function cb_deleteFeed(prev, id) {
    await prev;
    if (base === null)
	return true;
    let key = await getFeedKey(id);
    if (key !== undefined) {
	feedsKeyMap.delete(id);
	await base(FeedsTable).destroy(key);
    }
    return true;
}

async function cb_loadItemsBeyond(prev, min) {
    await prev;
    if (base === null)
	return [];
    let items = await base(ItemsTable).select({
	filterByFormula: "id > " + min,
	sort: [{field: "id"}]
    }).firstPage();

    let rets = [];
    for (let each of items.values()) {
	itemsKeyMap.set(each.get("id"), each.getId());
	let item = {
	    id: each.get("id"),
	    url: each.get("url") || "",
	    read: each.get("read") || false
	};
	let extra = each.get("extra") || "{}";
	let extraInfo = JSON.parse(extra);
	// just merge everything
	for (const [key, value] of Object.entries(extraInfo)) {
	    item[key] = value;
	}
	rets.push(item);
    }
    return rets;
}

async function cb_markRead(prev, id) {
    await prev;
    if (base === null)
	return true;
    let key = await getItemKey(id);
    if (key !== undefined) {
	await base(ItemsTable).update(key, {read: true});
    }
    return true;
}

async function cb_addItem(prev, item) {
    await prev;
    if (base === null)
	return item.id;
    let key = await getItemKey(id);
    if (key === undefined) {
	let extraInfo = {...item};
	delete extraInfo.id;
	delete extraInfo.url;
	delete extraInfo.read;
	let record = await base(ItemsTable).create({
	    id: item.id,
	    url: item.url,
	    read: item.read || false,
	    extra: JSON.stringify(extraInfo)
	});
	itemsKeyMap.set(item.id, record.getId());
    }
    return item.id;
}

async function cb_deleteItem(prev, id) {
    await prev;
    if (base === null)
	return true;
    let key = await getItemKey(id);
    if (key !== undefined) {
	itemsKeyMap.delete(id);
	await base(ItemsTable).destroy(key);
    }
    return true;
}

async function getFeedKey(id) {
    let key = feedsKeyMap.get(feed.id);
    if (key === undefined) {
	let feeds = await base(FeedsTable).select({
	    filterByFormula: "id = " + feed.id,
	}).firstPage();
	for (let each of feeds.values()) {
	    feedsKeyMap.set(each.get("id"), each.getId());
	};
	key = feedsKeyMap.get(feed.id);
    }
    return key;
}

async function getItemKey(id) {
    let key = itemsKeyMap.get(feed.id);
    if (key === undefined) {
	let items = await base(ItemsTable).select({
	    filterByFormula: "id = " + item.id,
	}).firstPage();
	for (let each of items.values()) {
	    itemsKeyMap.set(each.get("id"), each.getId());
	};
	key = itemsKeyMap.get(item.id);
    }
    return key;
}

function feedType(str) {
    switch(str) {
	case "json":
	    return FeedType.json;
	case "xml":
	    return FeedType.xml;
	default:
	    throw "unknown feed type" + str;
    }
}

function feedTypeStr(t) {
    switch(t) {
	case FeedType.json:
	    return "json";
	case FeedType.xml:
	    return "xml";
	default:
	    throw "unknown feed type" + t;
    }
}

function init() {
    if (!ApiKey)
	return null;
    
    Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: ApiKey
    });
    try {
	base = Airtable.base(BaseToken);
	return base;
    } catch (e) {
	console.error("Cannot connect to airtable. check your configuration");
	return null;
    }
}

/*
 * client side state
 */

let state = init();

// load as much as feeds from id up, non-inclusive.
function loadFeedsBeyond(id) {
    state = cb_loadFeedsBeyond(state, id);
    return state;
}

// updata a feed. create it if there is none
function upsertFeed(feed) {
    state = cb_upsertFeed(state, feed);
    return state;
}

// delete a feed.
function deleteFeed(id) {
    state = cb_deleteFeed(state, id);
    return state;
}

// load as much as items from id up, non-inclusive
function loadItemsBeyond(id) {
    state = cb_loadItemsBeyond(state, id);
    return state;
}

// mark an item read. do not create it if there is none
function markRead(id) {
    state = cb_markRead(state, id);
    return state;
}

// add an item. do nothing if there is already one
function addItem(item) {
    state = cb_addItem(state, item);
    return state;
}

// delete an item.
function deleteItem(id) {
    state = cb_deleteItem(state, id);
    return state;
}
