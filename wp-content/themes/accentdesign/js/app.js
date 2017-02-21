jQuery(document).ready(function($){

$(document).foundation();
  $( ".nav-toggle" ).click(function() {
    $(this).toggleClass("open");
    $("nav").fadeToggle(100);

    return false;
  });

  $(window).scroll(function() {
    if ($(this).scrollTop() > 50) {// can be whatever, 0 refers to the top space you allow
        $('.arrow').hide();// Hide your element
        if ($(this).width() > 768) {
          $('#header').addClass('scroll-header');
        }
    }
    else {
        $('.arrow').show();// It's just if you want to show back the element if we're back on top
        $('#header').removeClass('scroll-header');
    }
  });

});
