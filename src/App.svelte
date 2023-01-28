<script>

 // functions and stores
 import {forwardItem, backwardItem, length, cursor, alertText, alertType,
	 currentItem, running} from './airss_controller.js';

 import Article from './Article.svelte';
 import Subscribe from './Subscribe.svelte';
 import Config from './Config.svelte';
 import Trash from './Trash.svelte';

 // constants
 // screen is fundimental content shown in the window
 const Screens = {
     browse: 1,
     shuutdown: 2,
     subscribe: 3,
     trash: 4,
     config: 5
 };

 // fundimental states of the app
 let screen = Screens.browse;

 // form value
 let shouldUnsubscribe = false;

 let xDown = null;
 let yDown = null;

 // derived state
 $: leftDisabled = ($cursor <= 0) || (screen != Screens.browse);
 $: rightDisabled = ($cursor >= $length - 1) || (screen != Screens.browse);
 $: screen = !$running ? Screens.shutdown : screen;
 $: alertClass = alertClassFromType($alertType);

 // view functions

 function alertClassFromType(type) {
     switch (type) {
	 case "error":
	     return "alert alert-danger";
	 case "warning":
	     return "alert alert-warning";
	 default:
	     return "alert alert-info";
     }
 }

 function clickLeft() {
     window.scrollTo({top: 0});
     backwardItem();
 }

 function clickRight() {
     window.scrollTo({top: 0});
     forwardItem();
 }

 function browseTouchStart(evt) {
     xDown = evt.touches[0].clientX;
     yDown = evt.touches[0].clientY;
 }

 function browseTouchMove(evt) {
     if ( ! xDown || ! yDown || screen != Screens.browse ) {
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

 function clickReload() {
     location.reload();
 }

 function clearAlert() {
     $alertText = "";
 }

 function clickConfig() {
     screen = Screens.config;
 }

 function clickSubscribe() {
     screen = Screens.subscribe;
 }

 function clickTrash(e) {
     var button = e.currentTarget;
     shouldUnsubscribe = !button.hasAttribute("data-dummy");
     screen = Screens.trash;
 }

 function clickCancel() {
     screen = Screens.browse;
 }
</script>

<svelte:head>
    <title>Airss Reader({$cursor+1}/{$length})</title>
</svelte:head>

<div id="layout" class="relative min-h-screen flex flex-col lg:max-w-screen-lg lg:mx-auto">
    <div class="sticky top-0 bg-gray-100 p-2 flex">
	<div>
	    <a href="/"><img src="/images/airss_logo.png" class="inline-block h-8"></a>
	    <span class="text-gray-600 align-bottom whitespace-nowrap">{$cursor+1}/{$length}</span>
	</div>
      <div class="flex-grow text-right">
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
			 on:click={clickConfig}>🔧</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  on:click={clickSubscribe}>🍼</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  disabled={leftDisabled}
		  on:click={clickLeft}>◀</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  disabled={rightDisabled}
		  on:click={clickRight}>▶</button>
      </div>
  </div>
  <p class={alertClass} role="alert" on:click={clearAlert}>{@html $alertText}</p>
  <div class="flex-grow"
      on:touchstart|passive={browseTouchStart}
      on:touchmove|passive={browseTouchMove}>
  {#if screen == Screens.browse}
      <Article item={$currentItem} {clickTrash} />
  {:else if screen == Screens.shutdown}
      <button class="button py-1 px-6 inline-block rounded appearance-none font-bold
		     text-lg text-center border-0 text-white bg-purple-600"
	      on:click={clickReload}>Reload</button>
  {:else if screen == Screens.trash}
      <Trash item={$currentItem} {clickCancel} {shouldUnsubscribe} />
  {:else if screen == Screens.config}
      <Config {clickCancel} />
  {:else if screen == Screens.subscribe}
      <Subscribe {clickCancel}}/>
  {/if}
  </div>
  <div class="text-sm text-gray-700 p-2 flex text-center">
      <div class="w-1/2 text-left">
	  <a href="https://roastidio.us/roast" referrerpolicy="no-referrer-when-downgrade">Roast me at Roastidious</a>
      </div>
      <div class="w-1/2 text-right">
	  <a href="https://github.com/derek-zhou/airss" referrerpolicy="no-referrer-when-downgrade">Fork me on GitHub</a>
      </div>
  </div>
</div>
