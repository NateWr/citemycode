
if (chrome){
    browser = chrome
}

var devLog = function(str, obj){
    // only log to console if we're in Chrome with Nerd Mode enabled.
    if (settings && settings.showOaColor && navigator.userAgent.indexOf("Chrome") > -1){
        console.log("citemycode: " + str, obj)
    }
}
devLog("citemycode is running")

// global variables:
var iframeIsInserted = false
var settings = {}
var myHost = window.location.hostname
var allSources = []
var doi
var docAsStr;


/***********************************************************************************
 *
 *  utility and UX functions
 *
 ************************************************************************************/


function insertIframe(url){
		var iframe = document.createElement('iframe');

    // make sure we are not inserting iframe again and again
    if (iframeIsInserted){
        return false
    }

		var button = document.createElement('button');
		button.id = 'citemycode-button';
		button.innerText = 'Cite My Code';
		button.className = 'btn btn-sm ml-2';
		button.addEventListener('click', event => {
			document.getElementById('citemycode-modal')
				.className = 'citemycode-modal citemycode-modal--open';

			// Get the codemeta.json file
			$.ajax({
				url: url,
				method: 'GET',
				success(r) {
					var codemeta = JSON.parse(r);

					var bibTexProps = {
						/* Should contributors and maintainerse be included? */
						author: codemeta.author
							.map(author => author.familyName + ', ' + author.givenName)
							.join(' and '),
						title: codemeta.name,
						url: codemeta.codeRepository,
						version: codemeta.version,
						publisher: codemeta.provider.name,
						keywords: codemeta.keywords.join(', ')
					};

					var bibTex = '@misc{' + codemeta.identifier + ",";
					for (var prop in bibTexProps) {
						bibTex += "\n  " + prop + ' = {' + bibTexProps[prop] + '},';
					}
					bibTex = bibTex.substr(0, bibTex.length - 1) + "\n}";

					document.querySelector('.citemycode-modal__citation')
						.innerHTML = bibTex;
				}
			});
		});
		var parent = document.querySelector('.file-navigation');
		parent.insertBefore(button, parent.querySelector('.js-get-repo-select-menu'));

		// Modal scaffold
		var modal = document.createElement('div');
		modal.id = 'citemycode-modal';
		modal.className = 'citemycode-modal';
		var modalContent = document.createElement('div');
		modalContent.className = 'citemycode-modal__content';

		// Header
		var modalContentHeader = document.createElement('div');
		modalContentHeader.className = 'citemycode-modal__header';
		var modalCopyBtn = document.createElement('button');
		modalCopyBtn.className = 'btn btn-sm';
		modalCopyBtn.innerText = 'Copy to clipboard';
		modalCopyBtn.addEventListener('click', event => {
			// copy to clipboard
			// https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f
			var el = document.createElement('textarea');
			el.value = document.querySelector('.citemycode-modal__citation').innerHTML;
			document.body.appendChild(el);
			el.select();
			document.execCommand('copy');
			document.body.removeChild(el);
		});
		var modalCloseButton = document.createElement('button');
		modalCloseButton.className = 'btn btn-sm ml-2';
		modalCloseButton.innerText = 'Close';
		modalCloseButton.addEventListener('click', event => {
			document.getElementById('citemycode-modal')
				.className = 'citemycode-modal';
		});
		modalContentHeader.appendChild(modalCopyBtn);
		modalContentHeader.appendChild(modalCloseButton);

		// Citation
		var modalCitation = document.createElement('pre');
		modalCitation.className = 'citemycode-modal__citation';

		modalContent.appendChild(modalContentHeader);
		modalContent.appendChild(modalCitation);
		modal.appendChild(modalContent);
		document.body.appendChild(modal);

		var css = document.createElement('link');
		css.rel = 'stylesheet';
		css.href = browser.extension.getURL('stylesheet.css');
		css.type = 'text/css';
		document.body.appendChild(css);

    iframeIsInserted = true
}


function reportInstallation(){
    // this is so the citemycode.org/welcome page knows that this user
    // has actually installed the extension.
    var loc = window.location.host
    if (loc.indexOf("citemycode.org") === 0){
        devLog("installed. adding reporting div.")
        $("<div style='display:none' id='citemycode-is-installed'></div>")
            .appendTo("body")
    }
}

// from https://davidwalsh.name/get-absolute-url
var getAbsoluteUrl = (function() {
	var a;

	return function(url) {
		if(!a) a = document.createElement('a');
		a.href = url;

		return a.href;
	};
})();





/***********************************************************************************
 *
 *  Sanity checks
 *
 ************************************************************************************/

function checkRepoLandingPageUrl(gitHubURL) {
    /*
        Check if the URL can possibly be on a repo landing page
    */
    var regex = /^https:\/\/github.com\/[\w-]+\/[\w-]+\/?$/;
    if (regex.test(gitHubURL)) {
        return true;
    }
    else {
        return false;
    }
}


function checkUrlExists(url) {
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status!=404;
}


function codemetaExists(landingPageURL) {
    // Check if URL ends with slash, if not, add it
    if (landingPageURL.substr(-1) != '/') {
        landingPageURL += '/';
    }
    // Append CITATION.cff to the URL
		landingPageURL += "blob/master/codemeta.json"
    // Check if URL returns 404
    if (checkUrlExists(landingPageURL)) {
        return landingPageURL;
    }
    return undefined;
}





/***********************************************************************************
 *
 *  main method
 *
 ************************************************************************************/

function run() {
    reportInstallation()

    // Get the current URL
		var currUrl = window.location.href

    /* Check if the current URL starts with
    https://github.com

    We assume https protocol, as that's what GitHub
    uses per default and via forwarding from
    http.
    We also assume no www prefix, as GitHub
    forwards to non-prefixed URL per default.
    */
    if (currUrl.substring(0, 18) == "https://github.com") {
        /*
        Check if we should show the button
        */
        if (checkRepoLandingPageUrl(currUrl)) {
            // Check if a codemeta.json file exits according to the URL
						var cffURL = codemetaExists(currUrl);
            if (cffURL != undefined) {
								// Switch on button
                insertIframe(
									cffURL.replace('https://github.com', 'https://raw.githubusercontent.com')
										.replace('/blob/', '/')
								);
            }
        }
    }
}

function runWithSettings(){
    browser.storage.local.get(null, function(items){
        settings = items
        devLog("got settings", settings)
        run()
    });
}

function runWithDelay(){
		var delay = 200  // milliseconds

    // Single-page apps take a while to fully load all the HTML,
    // and until they do we can't find the DOI
    var longDelayHosts = [
        "github.com"
    ]

    // it would be better to poll, but that is more complicated and we don't
    // have many reports of SPAs like this yet.
    if (longDelayHosts.includes(myHost)) {
        delay = 500
    }

    setTimeout(runWithSettings, delay)
}

runWithDelay()


















