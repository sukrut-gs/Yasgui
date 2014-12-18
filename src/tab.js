'use strict';
var $ = require('jquery'),
	utils = require('./utils.js'),
	YASGUI = require('./main.js');
module.exports = function(yasgui, id, name) {
	//we only generate the settings for YASQE, as we modify lots of YASQE settings via the YASGUI interface
	//We leave YASR to store its settings separately, as this is all handled directly from the YASR controls
	var defaultPersistentYasqe = {
		endpoint: YASGUI.YASQE.defaults.sparql.endpoint,
		acceptHeaderGraph: YASGUI.YASQE.defaults.sparql.acceptHeaderGraph,
		acceptHeaderSelect: YASGUI.YASQE.defaults.sparql.acceptHeaderSelect,
		args: YASGUI.YASQE.defaults.sparql.args,
		defaultGraphs: YASGUI.YASQE.defaults.sparql.defaultGraphs,
		namedGraphs: YASGUI.YASQE.defaults.sparql.namedGraphs,
		requestMethod: YASGUI.YASQE.defaults.sparql.requestMethod,
	};
	
	if (!yasgui.persistentOptions.tabManager.tabs[id]) {
		yasgui.persistentOptions.tabManager.tabs[id] = {
			id: id,
			name: name,
			yasqe: defaultPersistentYasqe
		}
	}
	var persistentOptions = yasgui.persistentOptions.tabManager.tabs[id];
	var tab = {
		persistentOptions: persistentOptions
	};
	
	var menu = require('./tabPaneMenu.js')(yasgui, tab);
	var $pane = $('<div>', {id:persistentOptions.id, style: 'position:relative', class: 'tab-pane', role: 'tabpanel'}).appendTo(yasgui.tabManager.$tabPanesParent);
	
	var $paneContent = $('<div>', {class:'wrapper'}).appendTo($pane);
	var $paneMenu = menu.initWrapper().appendTo($pane);
	var $endpointInput;
	var addControlBar = function() {
		var $controlBar = $('<div>', {class: 'controlbar'}).appendTo($paneContent);
		var $form = $('<form>', {class: 'form-inline', role: 'form'}).appendTo($controlBar);
		
		
		var $formGroupButton = $('<div>', {class: 'form-group'}).appendTo($form);
		$('<button>', {type:'button', class: 'menuButton btn btn-default'})
			.on('click', function(e){
				if ($pane.hasClass('menu-open')) {
					$pane.removeClass('menu-open');
					menu.store();
				} else {
					menu.updateWrapper();
					$pane.addClass('menu-open');
//					utils.onOutsideClick($(".menu-slide,.menuButton"), function() {$pane.removeClass('menu-open'); menu.store();});
					$(".menu-slide,.menuButton").onOutsideClick(function() {$pane.removeClass('menu-open'); menu.store();});
					
				}
			})
			.append($('<span>', {class:'icon-bar'}))
			.append($('<span>', {class:'icon-bar'}))
			.append($('<span>', {class:'icon-bar'}))
			.appendTo($formGroupButton);
		
		//add endpoint text input
		var $formGroup = $('<div>', {class: 'form-group'}).appendTo($form);
		$endpointInput = $('<input>', {type: 'text', class: 'form-control endpointText', placeholder: 'Enter endpoint'})
			.on('keyup', function(){
				tab.persistentOptions.yasqe.endpoint = this.value;
				yasgui.store();
			})
			.val(tab.persistentOptions.yasqe.endpoint)
			.appendTo($formGroup);
	};
	
	addControlBar();
	var yasqeContainer = $('<div>', {id: 'yasqe_' + persistentOptions.id}).appendTo($paneContent);
	var yasrContainer = $('<div>', {id: 'yasq_' + persistentOptions.id}).appendTo($paneContent);
	
	var yasqeOptions = {
		createShareLink: function() {
			var output = tab.yasr.options.output;
			if (output == 'simpleTable') output = 'table';//for backwards compatability (yasgui v1 had this particular output plugin)
			

			var params = [
				{name: 'outputFormat', value: output},
				{name: 'query', value: tab.yasqe.getValue()},
				{name: 'contentTypeConstruct', value: persistentOptions.yasqe.acceptHeaderGraph},
				{name: 'contentTypeSelect', value: persistentOptions.yasqe.acceptHeaderSelect},
				{name: 'endpoint', value: persistentOptions.yasqe.endpoint},
				{name: 'requestMethod', value: persistentOptions.yasqe.requestMethod},
				{name: 'tabTitle', value: persistentOptions.name}
			];
			
			persistentOptions.yasqe.args.forEach(function(paramPair){
				params.push(paramPair);
			});
			persistentOptions.yasqe.namedGraphs.forEach(function(ng) {
				params.push({name: 'namedGraph', value: ng});
			});
			persistentOptions.yasqe.defaultGraphs.forEach(function(dg){
				params.push({name: 'defaultGraph', value: dg});
			});
			
			//extend existing link, so first fetch current arguments. But: make sure we don't include items already used in share link
			var keys = [];
			params.forEach(function(paramPair){keys.push(paramPair.name)});
			var currentParams = $.deparam(window.location.search.substring(1));
			for (var param in currentParams) {
				if (keys.indexOf(param) == -1) {
					params.push({name: param, value: currentParams[param]});
				}
			}
			return params;
		}
	};
	if (persistentOptions.yasqe.value) yasqeOptions.value = persistentOptions.yasqe.value;
	
	tab.onShow = function() {
		if (!tab.yasqe || !tab.yasr) {
			
			
			tab.yasqe = YASGUI.YASQE(yasqeContainer[0], yasqeOptions);
			tab.yasqe.on('blur', function(yasqe) {
				persistentOptions.yasqe.value = yasqe.getValue();
				yasgui.store();
			});
			tab.yasr = YASGUI.YASR(yasrContainer[0], {
				//this way, the URLs in the results are prettified using the defined prefixes in the query
				getUsedPrefixes: tab.yasqe.getPrefixesFromQuery
			});
			tab.yasqe.options.sparql.callbacks.complete = function() {
				tab.yasr.setResponse.apply(this, arguments);
				
				/**
				 * store query in hist
				 */
				persistentOptions.yasqe.value = tab.yasqe.getValue();//in case the onblur hasnt happened yet
				var resultSize = null;
				if (tab.yasr.results.getBindings()) {
					resultSize = tab.yasr.results.getBindings().length;
				}
				var histObject = {
					options: $.extend(true, {}, persistentOptions),//create copy
					resultSize: resultSize
				};
				delete histObject.options.name;//don't store this one
				yasgui.history.unshift(histObject);
			}
		}
	};
	
	tab.setOptions = function() {
	}
	tab.refreshYasqe = function() {
		$.extend(true, tab.yasqe.options.sparql, tab.persistentOptions.yasqe);
		tab.yasqe.setValue(tab.persistentOptions.yasqe.value);
//		console.log(tab.yasqe.options);
//		tab.yasqe.refresh();
	}
	tab.destroy = function() {
		console.log('todo: proper destorying of local storage');
	}
//	tab.generatePersistentSettings = function() {
//		//we only generate the settings for YASQE, as we modify lots of YASQE settings via the YASGUI interface
//		//We leave YASR to store its settings separately, as this is all handled directly from the YASR controls
//		return  {
//			name: tab.name,
//			yasqe: {
//				endpoint: tab.yasqe.options.sparql.endpoint,
//				acceptHeaderGraph: tab.yasqe.options.sparql.acceptHeaderGraph,
//				acceptHeaderSelect: tab.yasqe.options.sparql.acceptHeaderSelect,
//				args: tab.yasqe.options.sparql.args,
//				defaultGraphs: tab.yasqe.options.sparql.defaultGraphs,
//				namedGraphs: tab.yasqe.options.sparql.namedGraphs,
//				requestMethod: tab.yasqe.options.sparql.requestMethod,
//			}
//		}
//	};
	
	
	
	return tab;
}