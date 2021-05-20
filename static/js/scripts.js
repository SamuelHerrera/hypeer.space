/*!
* Start Bootstrap - Freelancer v6.0.6 (https://startbootstrap.com/theme/freelancer)
* Copyright 2013-2021 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-freelancer/blob/master/LICENSE)
*/
(function ($) {
    "use strict"; // Start of use strict

    // Smooth scrolling using anime.js
    $('a.js-scroll-trigger[href*="#"]:not([href="#"])').on('click', function () {
        if (
            location.pathname.replace(/^\//, "") ==
            this.pathname.replace(/^\//, "") &&
            location.hostname == this.hostname
        ) {
            var target = $(this.hash);
            target = target.length ?
                target :
                $("[name=" + this.hash.slice(1) + "]");
            if (target.length) {
                anime({
                    targets: 'html, body',
                    scrollTop: target.offset().top - 72,
                    duration: 1000,
                    easing: 'easeInOutExpo'
                });
                return false;
            }
        }
    });

    // Scroll to top button appear
    $(document).scroll(function () {
        var scrollDistance = $(this).scrollTop();
        if (scrollDistance > 100) {
            $('.scroll-to-top').fadeIn();
        } else {
            $('.scroll-to-top').fadeOut();
        }
    });

    // Closes responsive menu when a scroll trigger link is clicked
    $('.js-scroll-trigger').click(function () {
        $('.navbar-collapse').collapse('hide');
    });

    // Activate scrollspy to add active class to navbar items on scroll
    $('body').scrollspy({
        target: '#mainNav',
        offset: 80
    });

    // Collapse Navbar
    var navbarCollapse = function () {
        if ($("#mainNav").offset().top > 100) {
            $("#mainNav").addClass("navbar-shrink");
        } else {
            $("#mainNav").removeClass("navbar-shrink");
        }
    };
    // Collapse now if page is not at top
    navbarCollapse();
    // Collapse the navbar when page is scrolled
    $(window).scroll(navbarCollapse);

    // Floating label headings for the contact form
    $(function () {
        $("body").on("input propertychange", ".floating-label-form-group", function (e) {
            $(this).toggleClass("floating-label-form-group-with-value", !!$(e.target).val());
        }).on("focus", ".floating-label-form-group", function () {
            $(this).addClass("floating-label-form-group-with-focus");
        }).on("blur", ".floating-label-form-group", function () {
            $(this).removeClass("floating-label-form-group-with-focus");
        });


        // ---- bootstrapping-code
        //
        // so here's the boring part, the three.js initialization

        const hole = document.getElementById('hole');

        const width = hole.offsetWidth;
        const height = hole.offsetHeight;

        // create renderer-instance, scene, camera and controls
        // .... renderer
        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
        });
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000);
        if (renderer.extensions.get('ANGLE_instanced_arrays') === null) {
            console.error('ANGLE_instanced_arrays not supported');
        }

        // .... scene
        const scene = new THREE.Scene();

        // .... camera and controls
        const camera = new THREE.PerspectiveCamera(
            60, width / height, 0.1, 5000);
        // const controls = new THREE.OrbitControls(camera);

        camera.position.set(10, 70, -50);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        // .... run demo-code
        // initialize simulation
        const update = init(scene, camera);
        requestAnimationFrame(function loop(time) {
            // controls.update();

            // update simulation
            update(performance.now());
            renderer.render(scene, camera);

            requestAnimationFrame(loop);
        });

        // .... bind events
        window.addEventListener('resize', ev => {
            const hole = document.getElementById('hole');

            const width = hole.offsetWidth;
            const height = hole.offsetHeight;


            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });

        hole.appendChild(renderer.domElement);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        stringRandom.init('.el-st');
    });

})(jQuery); // End of use strict
