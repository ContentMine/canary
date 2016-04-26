jQuery(document).ready(function() {
  
  $('.expand').hide();
    
  var opener = function(event) {
    event.preventDefault();
    $('#cmheos').show();
    $('html, body').animate({ scrollTop: $('#' + $(this).attr('href')).offset().top - 20 }, 500);      
  }
  $('.opener').bind('click',opener);

  var nav = function() {
    var navs = '<p id="conavp"> \
      <!--<a href="http://contentmine.co" class="btn btn-xs btn-default btn-block">User page / sign up</a>--> \
      <a href="http://facts.contentmine.co" class="btn btn-xs btn-default btn-block">FACTS</a> \
      <a href="http://fotd.contentmine.co" class="btn btn-xs btn-default btn-block">Fact of the day</a> \
      <a href="http://redlist.contentmine.co" class="btn btn-xs btn-default btn-block">IUCN redlist</a> \
      <a href="http://bubbles.contentmine.co" class="btn btn-xs btn-default btn-block">Research networks</a> \
      <a href="http://contentmine.org" class="btn btn-xs btn-default btn-block">ContentMine project blog</a> \
    </p>';
    $('#conav').append(navs);
    var pg = window.location.host;
    console.log(pg);
    $('#conavp a').each(function() {
      if ( pg === $(this).href().replace('http://','').replace('https://','').replace('/','') ) {
        $(this).removeClass('btn-default').addClass('btn-primary');
      }
    });
  }
  if ( $('#conav') ) nav();
  
  var footer = function() {
    var footers = '<div id="footers" class="container-fluid" style="margin-bottom:50px;"> \
      <div class="row"> \
        <div class="col-md-3"> \
          <div class="well well-cm"> \
            <p>The <a href="http://contentmine.org">ContentMine</a> project.</p> \
            <p>&copy; <a href="https://www.shuttleworthfoundation.org/">Shuttleworth Foundation</a>, for whom Peter Murray-Rust is a fellow.</p> \
            <p>Unless otherwise noted, the content of the <span xmlns:dct="http://purl.org/dc/terms/" property="dct:title"> \
              ContentMine Website</span> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/"> \
              Creative Commons Attribution 4.0 International License</a>.</p> \
            <p>All extracted facts are <a rel="license" href="http://creativecommons.org/publicdomain/zero/1.0/">CC0</a>.</p> \
          </div> \
        </div> \
        <div class="col-md-3"> \
          <div class="well well-cm"> \
            <a href="mailto:contact@contentmine.org"><i class="fa fa-envelope" style="font-size:16.2em;color:#187c83;"></i></a> \
          </div> \
        </div> \
        <div class="col-md-3"> \
          <div class="well well-cm"> \
            <a href="https://twitter.com/TheContentMine" title="@TheContentMine"><i class="fa fa-twitter" style="font-size:16.2em;padding-left:10px;color:#187c83;"></i></a> \
          </div> \
        </div> \
        <div class="col-md-3"> \
          <div class="well well-cm"> \
            <a href="http://github.com/ContentMine" title="ContentMine"><i class="fa fa-github" style="font-size:16.2em;padding-left:15px;color:#187c83;"></i></a> \
          </div> \
        </div> \
      </div> \
    </div>';
    $('#cofooter').append(footers);
  }
  if ( $('#cofooter') ) footer();
  
});
