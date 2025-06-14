/*
 * The controller layer of AirSS.
 * The model layer also send events and change variables as the roots of reactivity
 * The model founctions are encapsulated for use by the view layer
 */

import {render} from './airss_view.js';
import * as Model from './airss_model.js';
import * as Loader from './loader.js';
import {Subscribe, Trash, Config} from './dialog.js';

// screen is fundimental content shown in the window
export const Screens = {
    browse: 1,
    shutdown: 2,
    subscribe: 3,
    trash: 4,
    config: 5
};

// the application state
var state;

// the set of elements that contain local state
var dirtyElements;

// does the screen not refrect the state
var renderDirty;

function init() {
    dirtyElements = new Set();
    renderDirty = false;
    state = {
	screen: Screens.browse,
	length: 0,
	cursor: -1,
	refreshing: false,
	alert: {
	    text: "",
	    type: "info"
	}
    };
    Model.init();
    // do I have a incoming api call to subscribe a feed
    if (location.search) {
	let params = new URLSearchParams(location.search.substring(1));
	let str = params.get("url");
	// clear location so it is cleaner
	let url = new URL("/", document.location.href);
	history.pushState({}, "", url.href);
	// do I have a refer so I can subscribe?
	if (params.has("subscribe-referrer") && document.referrer)
	    Loader.subscribe(document.referrer);
	else if (str)
	    Loader.subscribe(decodeURIComponent(str));
    }
    render(state);
}

export function focus_element(e) {
    dirtyElements.add(e.currentTarget);
}

export function blur_element(e) {
    let elem = e.currentTarget;
    if (element.value == "") {
	dirtyElements.delete(elem);
	if (renderDirty)
	    may_render();
    }
}

function elementDirty() {
    // scroll position is also local state
    return window.scrollY != 0 || dirtyElements.size > 0;
}

function may_render() {
    if (elementDirty()) {
	// postpone render when some element contains local state that would be destroyed
	renderDirty = true;
	return;
    }
    render(state);
    renderDirty = false;
}

function actionPreamble() {
    state.alert.text = "";
    // destroy local state to pave the way for rendering
    window.scrollTo({top: 0});
    dirtyElements.clear();
}

export function itemsLoadedEvent(length, cursor) {
    state.length = length;
    state.cursor = cursor;
    may_render();
}

export function itemUpdatedEvent(item) {
    state.currentItem = item;
    state.refreshing = false;
    may_render();
}

export function alertEvent(type, text) {
    state.alert.type = type;
    state.alert.text = text;
    may_render();
}

export function shutDownEvent(type, text) {
    state.alert.type = type;
    state.alert.text = text;
    state.screen = Screens.shutdown;
    state.screen = Screens.trash;
    may_render();
}

export function postHandleEvent(text) {
    state.postHandle = text;
    may_render();
}

// for swipes
let xDown = null;
let yDown = null;

export function touchStartEvent(e) {
    xDown = e.touches[0].clientX;
    yDown = e.touches[0].clientY;
}

export function touchMoveEvent(e) {
    if ( xDown && yDown && state.screen == Screens.browse ) {
	let xUp = e.touches[0].clientX;
	let yUp = e.touches[0].clientY;
	let xDiff = xDown - xUp;
	let yDiff = yDown - yUp;

	/*most significant*/
	if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
	    if ( xDiff > 0 ) {
		/* left swipe */
		e.preventDefault();
		actionPreamble();
		Model.forwardItem();
	    } else {
		/* right swipe */
		e.preventDefault();
		actionPreamble();
		Model.backwardItem();
	    }
	} else if (renderDirty) {
	    may_render();
	}

    }
    /* reset values */
    xDown = null;
    yDown = null;
}

export function clickLeftEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    Model.backwardItem();
}

export function clickRightEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    Model.forwardItem();
}

export function clickAlertEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    may_render();
}

export function clickConfigEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    // piggyback saving here
    Loader.save();
    state.screen = Screens.config;
    may_render();
}

export function clickSubscribeEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.subscribe;
    may_render();
}

export function clickTrashEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.trash;
    may_render();
}

export function submitSubscribeEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.currentTarget);
    Loader.subscribe(data.get(Subscribe.feedUrl));
    state.screen = Screens.browse;
}

export function resetDialogEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.browse;
    may_render();
}

export function submitTrashEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    if (state.currentItem) {
	let data = new FormData(e.currentTarget);
	if (data.get(Trash.shouldUnsubscribe))
	    Model.unsubscribe(state.currentItem.feedId);
	else
	    Model.deleteItem();
    }
    state.screen = Screens.browse;
    may_render();
}

export function submitConfigEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.currentTarget);
    // configuration update
    localStorage.setItem("WATER_MARK", data.get(Config.waterMark));
    localStorage.setItem("MIN_RELOAD_WAIT", data.get(Config.minReloadWait));
    localStorage.setItem("MAX_KEPT_PERIOD", data.get(Config.maxKeptPeriod));
    localStorage.setItem("MAX_ITEMS_PER_FEED", data.get(Config.maxItemsPerFeed));
    localStorage.setItem("TRUNCATE_ITEMS_PER_FEED", data.get(Config.truncateItemsPerFeed));
    localStorage.setItem("BOUNCE_LOAD", data.get(Config.bounceLoad) || "false");

    state.screen = Screens.browse;

    if (data.get(Config.clearDatabase) == "clear database") {
	Model.clearData();
    } else if (data.get(Config.restoreHandle)) {
	Loader.restore(data.get(Config.restoreHandle));
    }
    may_render();
}

export function clickRefreshEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.refreshing = true;
    Model.refreshItem();
}

export function clickReloadEvent(e) {
    e.preventDefault();
    init();
}

init();

document.addEventListener("keydown", (e) => {
    if (state.screen != Screens.browse)
	return;

    switch (e.key) {
    case 'n':
    case 'N':
	e.preventDefault();
	actionPreamble();
	Model.forwardItem();
	break;
    case 'p':
    case 'P':
	e.preventDefault();
	actionPreamble();
	Model.backwardItem();
	break;
    default:
	if (renderDirty) {
	    may_render();
	}
    }
});

document.addEventListener("visibilitychange", (e) => {
    if (elementDirty())
	return;
    if (document.hidden) {
	Model.shutdown("info", "Shutdown due to inactivity");
    } else {
	init();
    }
});
