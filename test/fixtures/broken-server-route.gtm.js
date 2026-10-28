// Synthetic container — mirrors the layout of a published gtm.js.
// Scenario: GA4 is routed through a server container at example.com/metrics,
// set in two places (config settings + event settings variables), and that
// path now answers with the site's 404 page.
(function(){

var data = {

"resource": {
  "version":"42",

  "macros":[{"function":"__e"},{"function":"__c","vtp_value":"G-TEST000001"},{"function":"__c","vtp_value":"https://example.com/metrics"},{"function":"__gtcs","vtp_configSettingsTable":["list",["map","parameter","server_container_url","parameterValue",["macro",2]]]},{"function":"__gtes","vtp_eventSettingsTable":["list",["map","parameter","user_id","parameterValue",["macro",5]],["map","parameter","server_container_url","parameterValue",["macro",2]]]},{"function":"__v","vtp_dataLayerVersion":2,"vtp_setDefaultValue":false,"vtp_name":"user_id"},{"function":"__gtcs","vtp_configSettingsTable":["list",["map","parameter","server_container_url","parameterValue","https://old.example.com/sgtm"]]},{"function":"__c","vtp_value":"1234567890123456"}],
  "tags":[{"function":"__googtag","metadata":["map"],"once_per_event":true,"vtp_tagId":["macro",1],"vtp_configSettingsVariable":["macro",3],"vtp_configSettingsTable":["list",["map","parameter","send_page_view","parameterValue","false"]],"tag_id":10},{"function":"__gaawe","metadata":["map"],"once_per_event":true,"vtp_eventName":"view_item","vtp_measurementIdOverride":["macro",1],"vtp_eventSettingsVariable":["macro",4],"tag_id":11},{"function":"__gaawe","metadata":["map"],"once_per_event":true,"vtp_eventName":"purchase","vtp_measurementIdOverride":["macro",1],"vtp_eventSettingsVariable":["macro",4],"tag_id":12},{"function":"__gaawe","metadata":["map"],"once_per_event":true,"vtp_eventName":"scroll","vtp_measurementIdOverride":["macro",1],"tag_id":13},{"function":"__html","metadata":["map"],"once_per_event":true,"vtp_html":"<script>!function(){var q=[]; if(q.length){}}();fbq(\"init\",\"1234567890123456\");fbq(\"track\",\"PageView\");<\/script>","vtp_supportDocumentWrite":false,"tag_id":14},{"function":"__paused","vtp_originalTagType":"gaawe","tag_id":15},{"function":"__gaawe","metadata":["map"],"once_per_event":true,"vtp_eventName":"legacy_click","vtp_measurementIdOverride":"G-OTHER00002","tag_id":16},{"function":"__html","metadata":["map"],"once_per_event":true,"vtp_html":"<script>console.log(\"orphan\")<\/script>","tag_id":17},{"function":"__cvt_123_45","metadata":["map"],"once_per_event":true,"vtp_pixelId":["macro",7],"vtp_eventName":"standard","tag_id":18}],
  "predicates":[{"function":"_eq","arg0":["macro",0],"arg1":"gtm.js"},{"function":"_eq","arg0":["macro",0],"arg1":"view_item"},{"function":"_eq","arg0":["macro",0],"arg1":"purchase"},{"function":"_eq","arg0":["macro",0],"arg1":"gtm.scrollDepth"}],
  "rules":[[["if",0],["add",0,4,8]],[["if",1],["add",1,6]],[["if",2],["add",2]],[["if",3],["add",3]]]
},
"runtime":[ [50,"__cvt_123_45",[46,"a"],[52,"b",["require","injectScript"]]] ]
,"permissions":{}
,"security_groups":{}
};

})();
