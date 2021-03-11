/*
 * The items schema, based on jsonfeed
 */

const SampleItem = {
    id: 0,
    read: false,
    feedTitle: "",
    feedId: 0,
    datePublished: null,
    contentHtml: "",
    url: "",
    imageUrl: "",
    title: "",
    tags: [],
    authors: []
};

export const Store = "items";

// items is an array of item ids in ascending order
let items = [];
let reading = -1;
let known = -1;

// public apis
export {upgrade, load, length, markRead,
	readingCursor, knownCursor, forwardCursor, backwardCursor, unreadCount,
	markRead, getCurrentItem, pushItem,
	parseJSONItem};

function parseJSONItem(json) {
    let item = new Object();
    item.datePublished = new Date(json.date_published);
    if (json.content_html !== undefined)
	item.contentHtml = json.content_html;
    else if (json.content_text !== undefined)
	item.contentHtml = '<pre>' + json.content_text + '</pre>';
    else
	throw "Malformed JSON";
    item.url = json.url;
    item.imageUrl = json.image_url;
    item.title = json.title;
    item.tags = json.tags;
    item.authors = json.authors;
}

function readingCursor() {
    return reading;
}

function knownCursor() {
    return known;
}

function unreadCount() {
    return items.length - known - 1;
}

function forwardCursor() {
    if (reading >= items.length - 1)
	return false;
    reading ++;
    if (known < reading)
	known = reading;
    return true;
}

function backwardCursor() {
    if (reading <= 0)
	return false;
    reading --;
}

function length() {
    return items.length;
}

async function markRead(db, item) {
    if (item.read)
	return;
    item.read = true;
    await db.put(Store, item);
}

function getCurrentItem(db) {
    return db.get(Store, items[reading]);
}

async function pushItem(db, item) {
    // it may throw, which will be catch outside
    await db.put(Store, item);
    // the id is auto-generated
    items.push(item.id);
}

function upgrade(db) {
    // the store holds all the feeds
    let store = db.createObjectStore(
	Store, {keyPath: "id", autoIncrement: true});
    store.createIndex("url", "url", {unique: true});
}

async function load(db) {
    let store = await db.transaction(Store).store;
    let cursor = await store.openCursor();

    items = [];
    known = -1;
    while (cursor) {
	// items from the beginning up to a point are read
	if (cursor.value.read)
	    known ++;
	items.push(cursor.key);
	cursor = await cursor.continue();
    }
    // point both cursor at the last read item
    reading = known;
}
