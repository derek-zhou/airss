import { createEffect, Switch, Match } from "solid-js";
import {forwardItem, backwardItem, length, cursor, alertText, alertType, currentItem,
	running, Screens, screen, setScreen, setAlertText} from './airss_controller.js';

import Article from './Article';
import Subscribe from './Subscribe';
import Config from './Config';
import Trash from './Trash';

// for swipes
let xDown = null;
let yDown = null;

function handleKeyDown(evt) {
    switch (evt.key) {
    case 'n':
    case 'N':
	clickRight();
	break;
    case 'p':
    case 'P':
	clickLeft();
	break;
    }
}

function browseTouchStart(evt) {
    xDown = evt.touches[0].clientX;
    yDown = evt.touches[0].clientY;
}

function browseTouchMove(evt) {
    if ( ! xDown || ! yDown || screen() != Screens.browse ) {
        return;
    }
    var xUp = evt.touches[0].clientX;
    var yUp = evt.touches[0].clientY;
    var xDiff = xDown - xUp;
    var yDiff = yDown - yUp;

    /*most significant*/
    if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
	if ( xDiff > 0 ) {
	    /* left swipe */
	    clickRight();
	} else {
	    /* right swipe */
	    clickLeft();
	}
    }
    /* reset values */
    xDown = null;
    yDown = null;
}

// derived signals
function leftDisabled() {
    return cursor() <= 0 || screen() != Screens.browse;
}

function rightDisabled() {
    return cursor() >= length() - 1 || screen() != Screens.browse;
}

function alertClass() {
    switch (alertType()) {
    case "error":
	return "alert alert-danger";
    case "warning":
	return "alert alert-warning";
    default:
	return "alert alert-info";
    }
}

function clickLeft() {
    if (screen() == Screens.browse) {
	window.scrollTo({top: 0});
	backwardItem();
    }
}

function clickRight() {
    if (screen() == Screens.browse) {
	window.scrollTo({top: 0});
	forwardItem();
    }
}

export default function App() {
    createEffect(() => {
	document.title = `Airss Reader(${cursor()+1}/${length()})`;
	document.addEventListener('keydown', handleKeyDown);
    });

    return (
<div id="layout" class="relative min-h-screen flex flex-col lg:max-w-screen-lg lg:mx-auto">
  <div class="bg-gray-100 p-2 flex">
    <div>
      <a href="/"><img src="/images/airss_logo.png" class="inline-block h-8" /></a>
      <span class="text-gray-600 align-bottom whitespace-nowrap">{cursor()+1}/{length()}</span>
    </div>
    <div class="flex-grow text-right">
	<button class="button py-1 text-purple-600 inline-block rounded appearance-none
		     font-bold text-lg text-center ml-1 px-1 sm:px-4"
	      onClick={() => setScreen(Screens.config)}>🔧
      </button>
      <button class="button py-1 text-purple-600 inline-block rounded appearance-none
		     font-bold text-lg text-center ml-1 px-1 sm:px-4"
	      onClick={() => setScreen(Screens.subscribe)}>🍼
      </button>
      <button class="button py-1 text-purple-600 inline-block rounded appearance-none
		     font-bold text-lg text-center ml-1 px-1 sm:px-4"
	      disabled={leftDisabled()}
	      onClick={clickLeft}>◀
      </button>
      <button class="button py-1 text-purple-600 inline-block rounded appearance-none
		     font-bold text-lg text-center ml-1 px-1 sm:px-4"
	      disabled={rightDisabled()}
	      onClick={clickRight}>▶
      </button>
    </div>
  </div>
  <p class={alertClass()} role="alert" onClick={() => setAlertText("")}
     innerHTML={alertText()} />
  <div class="flex-grow"
       onTouchStart={browseTouchStart}
       onTouchMove={browseTouchMove}>
    <Switch>
      <Match when={!running()}>
	<button class="button py-1 px-6 inline-block rounded appearance-none font-bold
		       text-lg text-center border-0 text-white bg-purple-600"
		onClick={() => location.reload()}>Reload
	</button>
      </Match>
      <Match when={screen() == Screens.browse}><Article /></Match>
      <Match when={screen() == Screens.trash}><Trash /></Match>
      <Match when={screen() == Screens.config}><Config /></Match>
      <Match when={screen() == Screens.subscribe}><Subscribe /></Match>
    </Switch>
  </div>
  <div class="text-sm text-gray-700 p-2 flex text-center">
    <div class="w-1/2 text-left">
      <a href="https://roastidio.us/roast" referrerpolicy="no-referrer-when-downgrade">
	Roast me at Roastidious
      </a>
    </div>
    <div class="w-1/2 text-right">
      <a href="https://github.com/derek-zhou/airss" referrerpolicy="no-referrer-when-downgrade">
	Fork me on GitHub
      </a>
    </div>
  </div>
</div>
    );
}
