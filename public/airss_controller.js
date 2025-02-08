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
var state = {
    screen: Screens.browse,
    length: 0,
    cursor: -1,
    currentItem: null,
    postHandle: null,
    loading: false,
    unsubscribeDefault: false,
    alert: {
	text: "",
	type: "info"
    }
};

View.render_all(state);
window.application_state = state;

function actionPreamble() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(timeoutShutdown, TimeoutPeriod);
    state.alert.text = "";
}

// shutdown the model layer. return a promise that reject
// when everything shutdown
function timeoutShutdown() {
    clearTimeout(idleTimeout);
    Model.shutdown("Shutdown due to inactivity");
}

document.addEventListener("AirSSModelItemsLoaded", e => {
    state.length = e.detail.length;
    state.cursor = e.detail.cursor;
    View.render_application(state);
});

document.addEventListener("AirSSModelItemUpdated", e => {
    state.currentItem = e.detail;
    View.render_article(state);
});

document.addEventListener("AirSSModelAlert", e => {
    state.alert.type = e.detail.type;
    state.alert.text = e.detail.text;
    View.render_alert(state);
    View.update_layout(state);
});

document.addEventListener("AirSSModelShutDown", e => {
    state.alert.type = e.detail.type;
    state.alert.text = e.detail.text;
    state.screen = Screens.shutdown;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener("AirSSModelStartLoading", () => {
    state.loading = true;
    console.log("loading on");
    View.update_layout(state);
});

document.addEventListener("AirSSModelStopLoading", () => {
    state.loading = false;
    console.log("loading off");
    View.update_layout(state);
});

document.addEventListener("AirSSModelPostHandle", e => {
    state.postHandle = e.detail.text;
    View.render_application(state);
});

document.addEventListener("AirSSModelInitDone", () => {
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
});

// for swipes
let xDown = null;
let yDown = null;

document.addEventListener("AirSSViewTouchStart", (e) => {
    xDown = e.detail.touches[0].clientX;
    yDown = e.detail.touches[0].clientY;
});

document.addEventListener("AirSSViewTouchMove", (e) => {
    if (state.screen == Screen.shutdown)
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

document.addEventListener("keydown", (e) => {
    if (state.screen == Screen.shutdown)
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

document.addEventListener("AirSSViewClickLeft", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    Model.backwardItem();
    View.update_layout(state);
});

document.addEventListener("AirSSViewClickRight", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    Model.forwardItem();
    View.update_layout(state);
});

document.addEventListener("AirSSViewClickAlert", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    View.update_layout(state);
});

document.addEventListener("AirSSViewClickConfig", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    // piggyback saving here
    Model.saveFeeds();
    state.screen = Screens.config;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener("AirSSViewClickSubscribe", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.subscribe;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener("AirSSViewClickTrash", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.trash;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener("AirSSViewSubmitSubscribe", (e) => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.target);
    Model.subscribe(data.get("feedUtl"));
    state.screen = Screens.browse;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener("AirSSViewResetDialog", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    state.screen = Screens.browse;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener("AirSSViewSubmitTrash", (e) => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    if (state.currentItem) {
	let data = new FormData(e.target);
	if (data.get("shouldUnsubscribe").checked)
	    unsubscribe(state.currentItem.feedId);
	else
	    deleteItem();
    }
    state.screen = Screens.browse;
    View.render_application(state);
    View.update_layout(state);
});

document.addEventListener("AirSSViewSubmitConfig", (e) => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    let data = new FormData(e.target);
    // configuration update
    localStorage.setItem("WATER_MARK", data.get("waterMark"));
    localStorage.setItem("MIN_RELOAD_WAIT", data.get("minReloadWait"));
    localStorage.setItem("MAX_KEPT_PERIOD", data.get("maxKeptPeriod"));
    localStorage.setItem("MAX_ITEMS_PER_FEED", data.get("maxItemsPerFeed"));
    localStorage.setItem("TRUNCATE_ITEMS_PER_FEED", data.get("truncateItemsPerFeed"));
    localStorage.setItem("BOUNCE_LOAD", data.get("bounceLoad"));

    // It is very hard to change config at run time, so I just pretend to shutdown
    // cannot really shutdown because model is still working
    state.screen = Screens.shutdown;

    if (data.clearDatabase == "clear database") {
	Model.clearData();
    } else if (data.restoreHandle && data.restoreHandle != "") {
	Model.restoreFeeds(handle);
    } else {
	// It is very hard to change config at run time, so I just pretend to shutdown
	state.alertType = "info";
	state.alertText = "Configuration changed, you must reload for it to take effect.";
	View.render_alert(state);
	View.render_application(state);
    }
    View.update_layout(state);
});

document.addEventListener("AirSSViewClickRefresh", () => {
    if (state.screen == Screen.shutdown)
	return;
    actionPreamble();
    Model.refreshItem();
    View.update_layout(state);
});

document.addEventListener("AirSSViewClickReload", () => {
    location.reload();
});
