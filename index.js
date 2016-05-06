'use strict';
var http = require('http');
// var url = require('url');
// var path = require('path');
var juice = require('juice');
var port = process.argv[2] || 8080;
http.createServer(function(request, response) {
  // var headers = request.headers;
  var body = [];
  var responseBody;
  response.setHeader('X-Powered-By', 'Sage Bionetworks Synapse');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'POST' && request.url === '/markdown2html') {
    request.on('error', function(err) {
      console.error(err);
      response.statusCode = 500;
      responseBody = {
        error: err
      };
      response.end(JSON.stringify(responseBody));
    }).on('data', function(chunk) {
      // collect request body into 'body'
      body.push(chunk);
    }).on('end', function() {
      body = Buffer.concat(body).toString();
      response.on('error', function(err) {
        console.error(err);
        response.statusCode = 500;
        responseBody = {
          error: err
        };
        response.end(JSON.stringify(responseBody));
      });
      response.statusCode = 200;

      var md = require('markdown-it')();
      var synapsePlugin = require('markdown-it-synapse');
      md.use(require('markdown-it-sub'))
        .use(require('markdown-it-sup'))
        .use(require('markdown-it-center-text'))
        .use(require('markdown-it-synapse-heading'))
        .use(require('markdown-it-synapse-table'))
        .use(require('markdown-it-strikethrough-alt'))
        .use(require('markdown-it-container'))
        .use(require('markdown-it-emphasis-alt'))
        .use(synapsePlugin)
        .use(require('markdown-it-synapse-math'));
      var resultHtml = md.render(synapsePlugin.preprocessMarkdown(body));
      // pull in portal css, inline css (for use in email)
      var requestResource = require('request');
      requestResource.get('https://www.synapse.org/Portal.css', function (error, resourceResponse, resourceBody) {
          if (!error && resourceResponse.statusCode == 200) {
            var css = resourceBody;
            var inlinedStyledHtml = juice.inlineContent(resultHtml, css);
            responseBody = {
              html: inlinedStyledHtml
            };
            response.end(JSON.stringify(responseBody));        
          }
      });
    });
  } else if ((request.method === 'GET' || request.method === 'HEAD') && request.url === '/healthcheck') {
      response.statusCode = 200;
      responseBody = {
          msg: "OK"
      };
      response.end(JSON.stringify(responseBody));
  } else {
    response.statusCode = 404;
    responseBody = {
        error: 'Server only supports POST to /markdown2html'
      };
    response.end(JSON.stringify(responseBody));
  }
}).listen(parseInt(port, 10));

console.log('Synapse markdown-it web server running on port ' + port);
