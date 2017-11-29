'use strict';
// Generated on 2014-07-26 using generator-leaflet 0.0.16

var gulp = require('gulp');
var open = require('open');
var wiredep = require('wiredep').stream;
var deploy = require("gulp-gh-pages");

// Load plugins
var $ = require('gulp-load-plugins')();

// Styles
gulp.task('styles', function () {
    return gulp.src(['app/styles/main.css'])
        .pipe($.autoprefixer('last 1 version'))
        .pipe(gulp.dest('app/styles'))
        .pipe($.size());
});

// Scripts
gulp.task('scripts', function () {
    return gulp.src(['app/scripts/**/*.js'])
        .pipe($.jshint('.jshintrc'))
        .pipe($.jshint.reporter('default'))
        .pipe($.size());
});

// HTML
gulp.task('html', ['styles', 'scripts'], function () {
    var jsFilter = $.filter('**/*.js');
    var cssFilter = $.filter('**/*.css');

    return gulp.src('app/*.html')
        .pipe($.useref.assets())
        .pipe(jsFilter)
        .pipe($.uglify())
        .pipe(jsFilter.restore())
        .pipe(cssFilter)
        .pipe($.csso())
        .pipe(cssFilter.restore())
        .pipe($.useref.restore())
        .pipe($.useref())
        .pipe(gulp.dest('dist'))
        .pipe($.size());
});

// Images
gulp.task('images', function () {
    return gulp.src([
            'app/images/**/*',
            'app/lib/images/*',
            'app/lib/styles/images/*'])
        .pipe($.cache($.imagemin({
            optimizationLevel: 3,
            progressive: true,
            interlaced: true
        })))
        .pipe(gulp.dest('dist/images'))
        .pipe($.size());
});

// Clean
gulp.task('clean', function () {
    return gulp.src(['dist/styles', 'dist/scripts', 'dist/images'], { read: false }).pipe($.clean());
});

// Build
gulp.task('build', ['html', 'images']);

// Default task
gulp.task('default', ['clean'], function () {
    gulp.start('build');
});

// Connect
gulp.task('connect', function(){
    $.connect.server({
        root: 'app',
        port: 9000,
        livereload: true
    });
});

// Open
gulp.task('serve', ['connect'], function() {
  open("http://localhost:9000");
});

// Inject Bower components
gulp.task('wiredep', function () {
    gulp.src('app/styles/*.css')
        .pipe(wiredep({
            directory: 'app/bower_components',
            ignorePath: 'app/bower_components/'
        }))
        .pipe(gulp.dest('app/styles'));

    gulp.src('app/*.html')
        .pipe(wiredep({
            directory: 'app/bower_components',
            ignorePath: 'app/'
        }))
        .pipe(gulp.dest('app'));
});

// Watch
gulp.task('watch', ['connect', 'serve'], function () {
    // Watch for changes in `app` folder
    gulp.watch([
        'app/*.html',
        'app/styles/**/*.css',
        'app/scripts/**/*.js',
        'app/images/**/*'
    ], function (event) {
        console.log('reload');
        return gulp.src(event.path)
            .pipe($.connect.reload());
    });

    // Watch .css files
    gulp.watch('app/styles/**/*.css', ['styles']);

    // Watch .js files
    gulp.watch('app/scripts/**/*.js', ['scripts']);

    // Watch image files
    gulp.watch('app/images/**/*', ['images']);

    // Watch bower files
    gulp.watch('bower.json', ['wiredep']);
});

// deploy on gh-pages
gulp.task('deploy', function () {
    gulp.src("./dist/**/*")
        .pipe(deploy());
});
