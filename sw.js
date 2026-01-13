const CACHE = 'meine-apps-1.7.2';

const FILES = [
    './',
    './index.html',
    './style.css',
    './icon.png',
    './seelenflamme/index.html',
    './seelenflamme/style.css',
    './seelenflamme/app.js',
    './routine/index.html',
    './routine/style.css',
    './routine/app.js',
    './stats/index.html',
    './stats/style.css',
    './stats/app.js',
    './FortniteRanks/Bronze.png',
'./FortniteRanks/Silber.png',
'./FortniteRanks/Gold.png',
'./FortniteRanks/Platin.png',
'./FortniteRanks/Diamant.png',
'./FortniteRanks/Elite.png',
'./FortniteRanks/Champion.png',
'./FortniteRanks/Unreal.png',
'./FortniteRanks/Unranked.png',
'./gymlog/index.html',
'./gymlog/style.css',
'./gymlog/app.js',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});