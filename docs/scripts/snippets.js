setTimeout(function () {
	$( ".tutorial-section pre, .readme-section pre, #main pre" ).each( function () {
	    var $this = $( this );

	    var example = $this.find( "code" );
	    exampleText = example.html();
	    var lang = /{@lang (.*?)}/.exec( exampleText );
	    if ( lang && lang[1] ) {
	        exampleText = exampleText.replace( lang[0], "" );
	        example.html( exampleText );
	        lang = lang[1];
	    } else {
	        lang = "javascript";
	    }

	    if ( lang ) {

	        $this
	        .addClass( "sunlight-highlight-" + lang )
	        .addClass( "linenums" )
	        .html( example.html() );

	    }
	} );
	Sunlight.highlightAll( {
		lineNumbers : true,
		showMenu : true,
		enableDoclinks : true
	} );
}, 1);
$.catchAnchorLinks( {
    navbarOffset: 10
} );

$( "#main span[id^='toc']" ).addClass( "toc-shim" );
$( '.dropdown-toggle' ).dropdown();



$( function () {
	$( '#main' ).localScroll( {
		offset : { top : 60 } //offset by the height of your header (give or take a few px, see what works for you)
	} );
	$( "dt.name" ).each( function () {
		var $this = $( this ).find("h4");
		var icon = $( "<i/>" ).addClass( "icon-plus-sign" ).addClass( "pull-right" ).addClass( "icon-white" );
		var dt = $(this);
		var children = dt.next( "dd" );

		dt.prepend( icon ).css( {cursor : "pointer"} );
		dt.addClass( "member-collapsed" ).addClass( "member" );


		children.hide();

		dt.children().on( "click", function () {
			children = dt.next( "dd" );
			children.slideToggle( "fast", function () {

				if ( children.is( ":visible" ) ) {
					icon.addClass( "icon-minus-sign" ).removeClass( "icon-plus-sign" ).removeClass( "icon-white" );
					dt.addClass( "member-open" ).animate( "member-collapsed" );
				} else {
					icon.addClass( "icon-plus-sign" ).removeClass( "icon-minus-sign" ).addClass( "icon-white" );
					dt.addClass( "member-collapsed" ).removeClass( "member-open" );
				}
			} );
		} );

	} );
	
    $( "table" ).each( function () {
        var $this = $( this );
        $this.addClass('table');
      } );
	
} );