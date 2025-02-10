/*
 * The controller layer of AirSS.
 * The model layer also send events and change variables as the roots of reactivity
 * The model founctions are encapsulated for use by the view layer
 */

import * as Model from './airss_model.js';
import * as View from './airss_view.js';

// timeout for the model to shutdown itself for inactivity
const TimeoutPeriod = 3600 * 1000;

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
	currentItem: null,
	postHandle: null,
	loading: false,
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
}

// shutdown the model layer. return a promise that reject
// when everything shutdown
function timeoutShutdown() {
    clearTimeout(idleTimeout);
    Model.shutdown("info", "Shutdown due to inactivity");
}

document.addEventListener(Model.Events.itemsLoaded, e => {
    state.length = e.detail.length;
    state.cursor = e.detail.cursor;
    View.render_application(state);
});

document.addEventListener(Model.Events.itemUpdated, e => {
    state.currentItem = e.detail;
    View.render_article(state);
});

document.addEventListener(Model.Events.alert, e => {
    state.alert.type = e.detail.type;
    state.alert.text = e.detail.text;
    View.render_alert(state);
    View.update_layout(state);
});

document.addEventListener(Model.Events.shutDown, e => {
    state.alert.type = e.detail.type;
    state.alert.text = e.detail.text;
    state.screen = Screens.shutdown;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener(Model.Events.startLoading, () => {
    state.loading = true;
    View.update_layout(state);
});

document.addEventListener(Model.Events.stopLoading, () => {
    state.loading = false;
    View.update_layout(state);
});

document.addEventListener(Model.Events.postHandle, e => {
    state.postHandle = e.detail.text;
    View.render_application(state);
});

document.addEventListener("keydown", (e) => {
    if (state.screen != Screens.browse)
	return;
    actionPreamble();

    switch (e.key) {
    case 'n':
    case 'N':
	Model.forwardItem();
	break;
    case 'p':
    case 'P':
	Model.backwardItem();
	break;
    }
    View.update_layout(state);
});

// for swipes
let xDown = null;
let yDown = null;

document.addEventListener(View.Events.touchStart, (e) => {
    xDown = e.detail.touches[0].clientX;
    yDown = e.detail.touches[0].clientY;
});

document.addEventListener(View.Events.touchMove, (e) => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();

    if ( xDown && yDown && state.screen != Screens.browse ) {
	let xUp = e.detail.touches[0].clientX;
	let yUp = e.detail.touches[0].clientY;
	let xDiff = xDown - xUp;
	let yDiff = yDown - yUp;

	/*most significant*/
	if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
	    if ( xDiff > 0 ) {
		/* left swipe */
		Model.backwardItem();
	    } else {
		/* right swipe */
		Model.forwardItem();
	    }
	}
    }
    View.update_layout(state);
    /* reset values */
    xDown = null;
    yDown = null;
});

document.addEventListener(View.Events.clickLeft, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    Model.backwardItem();
    View.update_layout(state);
});

document.addEventListener(View.Events.clickRight, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    Model.forwardItem();
    View.update_layout(state);
});

document.addEventListener(View.Events.clickAlert, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    View.update_layout(state);
});

document.addEventListener(View.Events.clickConfig, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    // piggyback saving here
    Model.saveFeeds();
    state.screen = Screens.config;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener(View.Events.clickSubscribe, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.subscribe;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener(View.Events.clickTrash, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.trash;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener(View.Events.submitSubscribe, (e) => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.detail.currentTarget);
    Model.subscribe(data.get(View.Subscribe.feedUrl));
    state.screen = Screens.browse;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener(View.Events.resetDialog, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.browse;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener(View.Events.submitTrash, (e) => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    if (state.currentItem) {
	let data = new FormData(e.detail.currentTarget);
	if (data.get(View.Trash.shouldUnsubscribe))
	    Model.unsubscribe(state.currentItem.feedId);
	else
	    Model.deleteItem();
    }
    state.screen = Screens.browse;
    View.update_layout(state);
});

document.addEventListener(View.Events.submitConfig, (e) => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.detail.currentTarget);
    // configuration update
    localStorage.setItem("WATER_MARK", data.get(View.Config.waterMark));
    localStorage.setItem("MIN_RELOAD_WAIT", data.get(View.Config.minReloadWait));
    localStorage.setItem("MAX_KEPT_PERIOD", data.get(View.Config.maxKeptPeriod));
    localStorage.setItem("MAX_ITEMS_PER_FEED", data.get(View.Config.maxItemsPerFeed));
    localStorage.setItem("TRUNCATE_ITEMS_PER_FEED", data.get(View.Config.truncateItemsPerFeed));
    localStorage.setItem("BOUNCE_LOAD", data.get(View.Config.bounceLoad) || "false");

    state.screen = Screens.browse;
    View.update_layout(state);
    // It is very hard to change config at run time, so I just take
    // shortcut to reload
    if (data.get(View.Config.clearDatabase) == "clear database") {
	Model.clearData();
    }

    Model.init();
    if (data.get(View.Config.restoreHandle)) {
	Model.restoreFeeds(data.get(View.Config.restoreHandle));
    }
});

document.addEventListener(View.Events.clickRefresh, () => {
    if (state.screen == Screens.shutdown)
	return;
    actionPreamble();
    Model.refreshItem();
    View.update_layout(state);
});

document.addEventListener(View.Events.clickReload, () => {
    init();
});

init();
