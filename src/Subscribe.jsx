import {subscribe, Screens, setScreen} from  './airss_controller.js';

let subscribeUrl;

function clickSubmitSubscribe(e) {
    e.preventDefault();
    subscribe(subscribeUrl.value);
    setScreen(Screens.browse);
}

function clickCancel(e) {
    e.preventDefault();
    setScreen(Screens.browse);
}

export default function Subscribe() {
    return (
<form onSubmit={clickSubmitSubscribe}>
  <section>
    <div class="field long">
      <label for="input-feed-url">
	The URL to the feed or the index page:
      </label>
      <input id="input-feed-url" type="text" class="long" ref={subscribeUrl}
	     placeholder="enter the url to subscribe" />
    </div>
  </section>
  <div class="toolbar">
    <input class="button" type="submit" value="👌" />
    <input class="button" type="reset" value="👎" onClick={clickCancel} />
  </div>
</form>
    );
}
