<script>

 // stores
 import {length, cursor, alertText, alertClass, currentItem, running} from './airss_controller.js';

 // functions
 import {forwardItem, backwardItem, subscribe, unsubscribe} from  './airss_controller.js';

 // constants
 // screen is fundimental content shown in the window
 const Screens = {
     browse: 0,
     shutdown: 1,
     subscribe: 2,
     unsubscribe: 3,
     airtable: 4
 };
 const UnknownImage = "/images/unknown_link.png";
 const roastPrefix = "https://roastidio.us/roast?url=";

 // fundimental states of the app
 let screen = Screens.browse;

 let subscribeUrl = "";

 let xDown = null;
 let yDown = null;

 // derived state
 $: leftDisabled = ($cursor <= 0) || (screen != Screens.browse);
 $: rightDisabled = ($cursor >= $length - 1) || (screen != Screens.browse);
 $: screen = !$running ? Screens.shutdown : screen;

 // view functions

 function browseTouchStart(evt) {
     xDown = evt.touches[0].clientX;
     yDown = evt.touches[0].clientY;
 }

 function browseTouchMove(evt) {
     if ( ! xDown || ! yDown ) {
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
	     forwardItem();
	 } else {
	     /* right swipe */
	     backwardItem();
	 }
     }
     /* reset values */
     xDown = null;
     yDown = null;
 }

 function clickReload() {
     location.reload();
 }

 function clickCloud() {
     screen = Screens.airtable;
 }

 function clickSubscribe() {
     screen = Screens.subscribe;
 }

 function clickUnsubscribe() {
     screen = Screens.unsubscribe;
 }

 function clickConfirmUnsubscribe() {
     unsubscribe($currentItem.feedId);
     screen = Screens.browse;
 }

 function clickSubmitSubscribe() {
     subscribe(subscribeUrl);
     screen = Screens.browse;
 }

 function clickCancel() {
     screen = Screens.browse;
 }

</script>

<div id="layout" class="viewport">
  <div class="header">
    <a class="brand-title" href="/">AirSS</a>
    <div class="nav">
      <button class="button"
	      on:click={clickCloud}>☁</button>
      <button class="button"
	      on:click={clickSubscribe}>☑</button>
      <button class="button"
	      disabled={leftDisabled}
	      on:click={backwardItem}>&#x276e;</button>
      {$cursor+1}/{$length}
      <button class="button"
	      disabled={rightDisabled}
	      on:click={forwardItem}>&#x276f;</button>
    </div>
  </div>
  <p class={$alertClass} role="alert">{$alertText}</p>
  <div class="content">
  {#if screen == Screens.browse}
      <div class="box"
	   on:touchstart={browseTouchStart}
	   on:touchmove={browseTouchMove}>
      {#if $currentItem}
	  <div class={$currentItem.imageUrl ? "thumbnail" : "thumbnail-missing"}>
	      <a href={$currentItem.url} target="item">
		  <img src={$currentItem.imageUrl ? $currentItem.imageUrl : UnknownImage}
		       alt="thumbnail"/></a>
	  </div>
	  <h4 class="title"><a href={$currentItem.url}
			       target="item">{$currentItem.title}</a></h4>
	  <h5 class="tag-line">
	      <span class="site">{$currentItem.feedTitle}</span>
	      <span class="site">
		  | {$currentItem.datePublished.toLocaleString()}
	      </span>
	      {#each $currentItem.tags as tag}
		  <span class="site"> | {tag} </span>
	      {/each}
	  </h5>
	  <p class="desc">
	      {@html $currentItem.contentHtml}
	  </p>
	  <div class="toolbar">
	      <button class="button button-danger"
		      on:click={clickUnsubscribe}>unsubscribe</button>
	      <a class="button" target="roast"
		 href={roastPrefix + encodeURIComponent($currentItem.url)}>roast!</a>
	  </div>
      {:else}
	  <h4>
	      No news is bad news. How about
	      <button class="button"
		      on:click={clickSubscribe}>subscribe</button>
	      something?
	  </h4>
      {/if}
      </div>
  {:else if screen == Screens.shutdown}
      <div class="box">
	  <button class="button"
		  on:click={clickReload}>Reload</button>
      </div>
  {:else if screen == Screens.unsubscribe}
      <div class="box">
	  <p>
	      Are you sure you want to unsubscribe {$currentItem.feedTitle}?
	  </p>
	  <div class="toolbar">
	      <button class="button"
		      on:click={clickConfirmUnsubscribe}>unsubscribe</button>
	      <button class="button button-danger"
		      on:click={clickCancel}>cancel</button>
	  </div>
      </div>
  {:else if screen == Screens.airtable}
      <div class="box">
	  <p>
	      Not implemented yet.
	  </p>
	  <div class="toolbar">
	      <button class="button button-danger"
		      on:click={clickCancel}>cancel</button>
	  </div>
      </div>
  {:else if screen == Screens.subscribe}
      <div class="box">
	  <form on:submit|preventDefault={clickSubmitSubscribe}>
	      <input type="text" bind:value={subscribeUrl}
		     placeholder="enter the url to subscribe">
	      <input class="button" type="submit" value="submit">
	      <input class="button" type="reset" value="cancel"
		     on:click="{clickCancel}">
	  </form>
      </div>
  {/if}
  </div>
  <div class="footer">
      <div class="copyright">
	  © <a href="https://blog.roastidio.us">roastidio.us</a>, 2021
      </div>
  </div>
</div>
