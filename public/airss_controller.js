/*
 * The controller layer of AirSS.
 * The model layer also send events and change variables as the roots of reactivity
 * The model founctions are encapsulated for use by the view layer
 */

import * as Model from './airss_model.js';
import * as View from './airss_view.js';

// timeout for the model to shutdown itself for inactivity
const TimeoutPeriod = 600 * 1000;

// watchdog to shutdown the backend when idel long enough
let idleTimeout = setTimeout(timeoutShutdown, TimeoutPeriod);

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

function init() {
    state = {
	screen: Screens.browse,
	length: 0,
	cursor: -1,
	loading: true,
	alert: {
	    text: "",
	    type: "info"
	}
    };
    View.render_all(state);
    window.application_state = state;
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
	    Model.subscribe(document.referrer);
	else if (str)
	    Model.subscribe(decodeURIComponent(str));
    }
}

function actionPreamble() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(timeoutShutdown, TimeoutPeriod);
    state.alert.text = "";
    View.render_alert(state);
}

// shutdown the model layer. return a promise that reject
// when everything shutdown
function timeoutShutdown() {
    clearTimeout(idleTimeout);
    Model.shutdown("info", "Shutdown due to inactivity");
}

export function itemsLoadedEvent(length, cursor) {
    state.length = length;
    state.cursor = cursor;
    View.render_application(state);
}

export function itemUpdatedEvent(item) {
    state.currentItem = item;
    View.render_article(state);
    if (item)
	window.scrollTo({top: 0});
}

export function alertEvent(type, text) {
    state.alert.type = type;
    state.alert.text = text;
    View.render_alert(state);
    if (text)
	window.scrollTo({top: 0});
}

export function shutDownEvent(type, text) {
    state.alert.type = type;
    state.alert.text = text;
    state.screen = Screens.shutdown;
    View.render_all(state);
}

export function startLoadingEvent() {
    state.loading = true;
    View.render_progress_bar(state);
}

export function stopLoadingEvent() {
    state.loading = false;
    View.render_progress_bar(state);
}

export function postHandleEvent(text) {
    state.postHandle = text;
    View.render_application(state);
}

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
    }
});

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
		Model.backwardItem();
	    } else {
		/* right swipe */
		e.preventDefault();
		actionPreamble();
		Model.forwardItem();
	    }
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
}

export function clickConfigEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    // piggyback saving here
    Model.saveFeeds();
    state.screen = Screens.config;
    View.render_all(state);
}

export function clickSubscribeEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.subscribe;
    View.render_all(state);
}

export function clickTrashEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.trash;
    View.render_all(state);
}

export function submitSubscribeEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.currentTarget);
    Model.subscribe(data.get(View.Subscribe.feedUrl));
    state.screen = Screens.browse;
    View.render_all(state);
}

export function resetDialogEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.browse;
    View.render_all(state);
}

export function submitTrashEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    if (state.currentItem) {
	let data = new FormData(e.currentTarget);
	if (data.get(View.Trash.shouldUnsubscribe))
	    Model.unsubscribe(state.currentItem.feedId);
	else
	    Model.deleteItem();
    }
    state.screen = Screens.browse;
    View.render_all(state);
}

export function submitConfigEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.currentTarget);
    // configuration update
    localStorage.setItem("WATER_MARK", data.get(View.Config.waterMark));
    localStorage.setItem("MIN_RELOAD_WAIT", data.get(View.Config.minReloadWait));
    localStorage.setItem("MAX_KEPT_PERIOD", data.get(View.Config.maxKeptPeriod));
    localStorage.setItem("MAX_ITEMS_PER_FEED", data.get(View.Config.maxItemsPerFeed));
    localStorage.setItem("TRUNCATE_ITEMS_PER_FEED", data.get(View.Config.truncateItemsPerFeed));
    localStorage.setItem("BOUNCE_LOAD", data.get(View.Config.bounceLoad) || "false");

    state.screen = Screens.browse;
    View.render_all(state);

    if (data.get(View.Config.clearDatabase) == "clear database") {
	Model.clearData();
    }
    if (data.get(View.Config.restoreHandle)) {
	Model.restoreFeeds(data.get(View.Config.restoreHandle));
    }
}

export function clickRefreshEvent(e) {
    e.preventDefault();
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    Model.refreshItem();
}

export function clickReloadEvent(e) {
    e.preventDefault();
    init();
}

init();
