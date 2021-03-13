/*
 * The items schema, based on jsonfeed
 */
import {unescape} from 'html-escaper';

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
    tags: []
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
	parseJSONItem, parseRSS2Item, parseATOMItem};

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
    item.imageUrl = json.image;
    item.title = json.title;
    item.tags = json.tags;
    return item;
}

function getXMLTextContent(elem, selector) {
    const sub = elem.querySelector(selector);
    if (sub)
	return sub.textContent;
    else
	return null;
}

function parseRSS2Item(elem) {
    let item = new Object();
    const pubDate = getXMLTextContent(elem, "pubDate");
    const description = getXMLTextContent(elem, "description");
    const link = getXMLTextContent(elem, "link");
    const title = getXMLTextCOntent(elem, "tltle");
    const categories = elem.querySelectorAll("category");
    let tags = [];
    for (let category of categories.values()) {
	tags = [...tags, category.textContent];
    }
    if (pubDate)
	item.datePublished = new Date(pubDate);
    if (description)
	item.contentHtml = unescape(description);
    if (link)
	item.url = link;
    if (title)
	item.title = title;
    if (tags)
	item.tags = tags;
    return item;
}

function parseATOMItem(elem) {
    let item = new Object();
    const published = getXMLTextContent(elem, "published");
    const updated = getXMLTextContent(elem, "updated");
    const content = getXMLTextContent(elem, "content");
    const summary = getXMLTextContent(elem, "summary");
    const link = getXMLTextContent(elem, "link");
    const title = getXMLTextCOntent(elem, "tltle");
    const categories = elem.querySelectorAll("category");
    let tags = [];
    for (let category of categories.values()) {
	tags = [...tags, category.textContent];
    }
    if (published)
	item.datePublished = new Date(published);
    else if (updated)
	item.datePublished = new Date(updated);
    if (content)
	item.contentHtml = content;
    else if (summary)
	item.contentHtml = '<pre>' + summary + '</pre>';
    if (link)
	item.url = link;
    if (title)
	item.title = title;
    if (tags)
	item.tags = tags;
    return item;
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
    return true;
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
    if (reading >= 0)
	return db.get(Store, items[reading]);
    else
	return null;
}

async function pushItem(db, item) {
    // it may throw, which will be catch outside
    let id = await db.add(Store, item);
    items.push(id);
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
