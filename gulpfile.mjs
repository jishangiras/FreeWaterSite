import gulp from 'gulp';
import uglify from 'gulp-uglify';
import cleanCSS from 'gulp-clean-css';
import htmlmin from 'gulp-htmlmin';
import concat from 'gulp-concat';
import htmlreplace from 'gulp-html-replace';
import { deleteAsync } from 'del';

// Paths to various files
const paths = {
    scripts: {
        src: 'src/js/**/*.js',
        dest: 'dist/js/'
    },
    styles: {
        src: 'src/css/**/*.css',
        dest: 'dist/css/'
    },
    html: {
        src: 'src/**/*.html',
        dest: 'dist/'
    },
    images: {
        src: 'src/images/**/*.{jpg,jpeg,png,svg,gif}',
        dest: 'dist/images/'
    }
};

// Clean up the dist directory
async function clean() {
    return await deleteAsync(['dist']);
}

// Minify and concatenate JavaScript files
function scripts() {
    return gulp.src(paths.scripts.src)
        .pipe(concat('main.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest(paths.scripts.dest));
}

// Minify and concatenate CSS files
function styles() {
    return gulp.src(paths.styles.src)
        .pipe(concat('main.min.css'))
        .pipe(cleanCSS())
        .pipe(gulp.dest(paths.styles.dest));
}

// Minify HTML files and replace references to minified CSS and JS
function html() {
    return gulp.src(paths.html.src)
        .pipe(htmlreplace({
            'css': 'css/main.min.css',
            'js': 'js/main.min.js'
        }))
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest(paths.html.dest));
}

// Copy images to dist
function images() {
    return gulp.src(paths.images.src)
        .pipe(gulp.dest(paths.images.dest));
}

// Define complex tasks
const build = gulp.series(clean, gulp.parallel(scripts, styles, html, images));

// Export tasks
export { clean, scripts, styles, html, images, build };
export default build;
