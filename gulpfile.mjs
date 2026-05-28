import gulp from 'gulp';
import terser from 'gulp-terser'; // Use gulp-terser instead of gulp-uglify
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
        src: 'src/images/**/*.{jpg,jpeg,png,svg,gif,ico,webp}',
        dest: 'dist/images/'
    },
    cname: {
        src: 'src/CNAME',
        dest: 'dist/'
    },
    vendor: {
        src: [
            'node_modules/leaflet/dist/leaflet.js',
            'node_modules/leaflet/dist/leaflet.css',
            'node_modules/leaflet/dist/images/**'
        ],
        destJs: 'dist/vendor/',
        destCss: 'dist/vendor/',
        destImages: 'dist/vendor/images/'
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
        .pipe(terser()) // Use terser for minifying and obfuscating
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
const buildVersion = Date.now();

function html() {
    return gulp.src(paths.html.src)
        .pipe(htmlreplace({
            'css': `css/main.min.css?v=${buildVersion}`,
            'js': `js/main.min.js?v=${buildVersion}`
        }))
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest(paths.html.dest));
}

// Copy images to dist
function images() {
    return gulp.src(paths.images.src)
        .pipe(gulp.dest(paths.images.dest));
}

// Copy CNAME for GitHub Pages custom domain
function cname() {
    return gulp.src(paths.cname.src)
        .pipe(gulp.dest(paths.cname.dest));
}

// Vendor Leaflet locally (avoids CDN dependency, enables offline/preview use)
function vendor() {
    gulp.src('node_modules/leaflet/dist/leaflet.js').pipe(gulp.dest(paths.vendor.destJs));
    gulp.src('node_modules/leaflet/dist/leaflet.css').pipe(gulp.dest(paths.vendor.destCss));
    return gulp.src('node_modules/leaflet/dist/images/**').pipe(gulp.dest(paths.vendor.destImages));
}

// Define complex tasks
const build = gulp.series(clean, gulp.parallel(scripts, styles, html, images, cname, vendor));

// Export tasks
export { clean, scripts, styles, html, images, cname, vendor, build };
export default build;
