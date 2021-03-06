'use strict';
var express = require('express');
var bodyParser = require('body-parser');
var juice = require('juice');
var router = express.Router();
var port = process.argv[2] || 8080;
var md = require('markdown-it')();
var synapsePlugin = require('markdown-it-synapse');
synapsePlugin.init_markdown_it(md,
  require('markdown-it-sub-alt'), 
  require('markdown-it-sup-alt'),
  require('markdown-it-center-text'),
  require('markdown-it-synapse-heading'),
  require('markdown-it-synapse-table'),
  require('markdown-it-strikethrough-alt'),
  require('markdown-it-container'),
  require('markdown-it-emphasis-alt'),
  require('markdown-it-inline-comments'),
  require('markdown-it-br'));

var defaultLinkOpenRender = md.renderer.rules.link_open
    || function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
function sendRelativeLinksToBaseURL(baseURL) {
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    if (baseURL) {
      var hrefIndex = tokens[idx].attrIndex('href');
      var currentHrefValue = tokens[idx].attrs[hrefIndex][1];
      if (hrefIndex > -1 && currentHrefValue && currentHrefValue.startsWith('#!')) {
        // replace href, prepend domain for relative link
        tokens[idx].attrs[hrefIndex][1] = baseURL + currentHrefValue;
      }
    }
    // pass token to default renderer.
    return defaultLinkOpenRender(tokens, idx, options, env, self);
  };
}

// accept json
router.use(bodyParser.json());
// set up a health check service
var healthCheckFunction = function(request, response) {
  response.statusCode = 200;
  response.end(JSON.stringify( { msg: 'OK' }));  
};
router.get('/healthcheck', healthCheckFunction);
router.head('/healthcheck', healthCheckFunction);
// set a default error handler
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.render('error', { error: err });
}
router.use(errorHandler);
// set up the markdown processor service
router.post('/markdown2html', function (request, response) {
  if (!request.body.markdown) {
    response.status(500).send(JSON.stringify({error: '"markdown" undefined'}));
    return;
  }
  response.setHeader('X-Powered-By', 'Sage Bionetworks Synapse');
  response.setHeader('Content-Type', 'application/json');
  response.statusCode = 200;
  md.use(synapsePlugin, '', request.body.baseURL)
    .use(require('markdown-it-synapse-math'));
  sendRelativeLinksToBaseURL(request.body.baseURL);
  var resultHtml = md.render(synapsePlugin.preprocessMarkdown(request.body.markdown));
  // default is Synapse styled html
  var output;
  if (request.body.output) {
    output = request.body.output;
  }
  if (output === 'html') {
    response.end(JSON.stringify({ result: resultHtml }));
  } else if (output === 'plain') {
    var plainText = require('html-to-text').fromString(resultHtml, {
        wordwrap: 130
    });
    response.end(JSON.stringify({ result: plainText }));
  } else {
    // pull in portal css, inline css (for use in email)
    var requestResource = require('request');
    requestResource.get('https://www.synapse.org/Portal.css', function (error, resourceResponse, resourceBody) {
        if (!error && resourceResponse.statusCode == 200) {
          var css = resourceBody;
          var inlinedStyledHtml = juice.inlineContent(resultHtml, css);
          response.end(JSON.stringify({ result: inlinedStyledHtml }));        
        }
    });
  }
});

module.exports = router;
