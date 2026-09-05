/////////////////////////////////////////////////////////////////////
// jQuery for page scrolling feature - requires jQuery Easing plugin
/////////////////////////////////////////////////////////////////////

$('.page-scroll').bind('click', function(event) {
    var $anchor = $(this);
    $('html, body').stop().animate({
        scrollTop: $($anchor.attr('href')).offset().top -64
    }, 1500, 'easeInOutExpo');
    event.preventDefault();
});



////////////////////////////////////////////////////////////////////////
// On-Scroll Animated Header: https://github.com/codrops/AnimatedHeader
////////////////////////////////////////////////////////////////////////

var cbpAnimatedHeader = (function() {

    var docElem = document.documentElement,
        header = document.querySelector( '.navbar-fixed-top' ),
        didScroll = false,
        changeHeaderOn = 10;

    function init() {
        window.addEventListener( 'scroll', function( event ) {
            if( !didScroll ) {
                didScroll = true;
                setTimeout( scrollPage, 250 );
            }
        }, false );
    }

    function scrollPage() {
        var sy = scrollY();
        if ( sy >= changeHeaderOn ) {
            classie.add( header, 'navbar-shrink' );
        }
        else {
            classie.remove( header, 'navbar-shrink' );
        }
        didScroll = false;
    }

    function scrollY() {
        return window.pageYOffset || docElem.scrollTop;
    }

    init();

})();



//////////////////////////////////////////////
// Highlight the top nav as scrolling occurs
//////////////////////////////////////////////

$('body').scrollspy({
    target: '.navbar',
    offset: 65
})



///////////////////////////////////////////
// Display loading image while page loads
///////////////////////////////////////////

// Wait for window load
$(window).load(function() {
    // Animate loader off screen
    $(".page-loader").fadeOut("slow");
});



////////////////////////////////////////////////////
// OWL Carousel: http://owlgraphic.com/owlcarousel
////////////////////////////////////////////////////

// Intro text carousel
$("#owl-intro-text").owlCarousel({
    singleItem : true,
    autoPlay : 6000,
    stopOnHover : true,
    navigation : false,
    navigationText : false,
    pagination : true
})

// Portfolio filtering: each side shows the first 2 cards by default and a
// "More" / "Show Less" toggle reveals the rest. Filtering still applies first.
$(document).ready(function() {
    var PILLAR_LIMIT = 2;

    // Which subcategory filter is active on this side (empty = show all)
    function activeFilter($side) {
        var $activeBtn = $side.find('.subcategory-btn.active');
        return $activeBtn.length ? $activeBtn.attr('data-filter').replace(/^\./, '') : '';
    }

    // Show/hide a pillar's cards up to the limit (or all when expanded), then
    // update the "More"/"Show Less" button. Respects the active filter.
    function applyPillar($side) {
        var filterClass = activeFilter($side);
        var expanded = $side.hasClass('pillar-expanded');
        var $btn = $side.find('.pillar-more-btn');

        // Eligible cards for this side (in document order) after filtering
        var $cards = $side.find('.mix').filter(function() {
            return !filterClass || $(this).hasClass(filterClass);
        });

        var total = $cards.length;
        var showCount = expanded ? total : Math.min(total, PILLAR_LIMIT);

        // Hide anything not in the eligible set, reveal up to showCount
        $side.find('.mix').not($cards).hide();
        $cards.each(function(i) {
            if (i < showCount) {
                $(this).show().find('.project-card').addClass('animated');
            } else {
                $(this).hide();
            }
        });

        // Toggle button visibility / label
        if ($btn.length) {
            if (total <= PILLAR_LIMIT) {
                $btn.hide();
            } else {
                $btn.text(expanded ? 'Show Less' : 'More').show();
            }
        }
    }

    // Make every card visible-capable (the .animate-on-scroll class starts
    // hidden) and create a "More" button under each pillar grid if none exists.
    $('.pillar-side').each(function() {
        var $side = $(this);
        if ($side.find('.pillar-more-btn').length === 0) {
            $side.find('.row').first().after('<button type="button" class="pillar-more-btn">More</button>');
        }
        $side.find('.animate-on-scroll').addClass('animated');
    });

    // Wire up filtering + the "More"/"Show Less" toggle per pillar side
    $('.pillar-side').each(function() {
        var $side = $(this);

        $side.find('.subcategory-btn').on('click', function() {
            var $btn = $(this);
            if ($btn.hasClass('active')) {
                $btn.removeClass('active'); // toggle off -> show all on this side
            } else {
                $side.find('.subcategory-btn').removeClass('active');
                $btn.addClass('active');
            }
            $side.removeClass('pillar-expanded'); // re-collapse to the limit
            applyPillar($side);
        });

        $side.find('.pillar-more-btn').on('click', function() {
            $side.toggleClass('pillar-expanded');
            applyPillar($side);
        });

        applyPillar($side); // set the initial collapsed state
    });
});


// Partner carousel
$("#owl-partners").owlCarousel({
    items : 4,
    itemsDesktop : [1199,3],
    itemsDesktopSmall : [980,2],
    itemsTablet: [768,2],
    autoPlay : 5000,
    stopOnHover : true,
    pagination : false
})

// Testimonials carousel
$("#owl-testimonial").owlCarousel({
    singleItem : true,
    pagination : true,
    autoHeight : true
})


////////////////////////////////////////////////////////////////////
// Stellar (parallax): https://github.com/markdalgleish/stellar.js
////////////////////////////////////////////////////////////////////

$.stellar({
    // Set scrolling to be in either one or both directions
    horizontalScrolling: false,
    verticalScrolling: true,
});



///////////////////////////////////////////////////////////
// WOW animation scroll: https://github.com/matthieua/WOW
///////////////////////////////////////////////////////////

new WOW().init();



////////////////////////////////////////////////////////////////////////////////////////////
// Counter-Up (requires jQuery waypoints.js plugin): https://github.com/bfintal/Counter-Up
////////////////////////////////////////////////////////////////////////////////////////////

$('.counter').counterUp({
    delay: 10,
    time: 2000
});



////////////////////////////////////////////////////////////////////////////////////////////
// Isotop Package (Legacy - kept for reference)
////////////////////////////////////////////////////////////////////////////////////////////



/////////////////////////
// Scroll to top button
/////////////////////////

// Check to see if the window is top if not then display button
$(window).scroll(function(){
    if ($(this).scrollTop() > 100) {
        $('.scrolltotop').fadeIn();
    } else {
        $('.scrolltotop').fadeOut();
    }
});

// Click event to scroll to top
$('.scrolltotop').click(function(){
    $('html, body').animate({scrollTop : 0}, 1500, 'easeInOutExpo');
    return false;
});



////////////////////////////////////////////////////////////////////
// Close mobile menu when click menu link (Bootstrap default menu)
////////////////////////////////////////////////////////////////////

$(document).on('click','.navbar-collapse.in',function(e) {
    if( $(e.target).is('a') && $(e.target).attr('class') != 'dropdown-toggle' ) {
        $(this).collapse('hide');
    }
});