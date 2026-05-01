import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                team: resolve(__dirname, 'team.html'),
                careers: resolve(__dirname, 'careers.html'),
                privacy: resolve(__dirname, 'privacy.html'),
                terms: resolve(__dirname, 'terms.html'),
                quote: resolve(__dirname, 'quote.html'),
                gallery: resolve(__dirname, 'gallery.html'),
                svcLawnCare: resolve(__dirname, 'services/lawn-care.html'),
                svcGardenBeds: resolve(__dirname, 'services/garden-beds.html'),
                svcHardscaping: resolve(__dirname, 'services/hardscaping.html'),
                svcPropertyCleanup: resolve(__dirname, 'services/property-cleanup.html'),
                svcLandscapeDesign: resolve(__dirname, 'services/landscape-design.html'),
                areaEastLincoln: resolve(__dirname, 'areas/east-lincoln.html'),
                areaPineLake: resolve(__dirname, 'areas/pine-lake.html'),
                areaSouthLincoln: resolve(__dirname, 'areas/south-lincoln.html'),
                areaWaverly: resolve(__dirname, 'areas/waverly.html'),
                areaBeatrice: resolve(__dirname, 'areas/beatrice.html'),
                blogIndex: resolve(__dirname, 'blog/index.html'),
                blogSpringLawn: resolve(__dirname, 'blog/spring-lawn-care-checklist-lincoln-ne.html'),
                blogPaverCost: resolve(__dirname, 'blog/paver-patio-cost-lincoln-ne.html'),
                blogOverseed: resolve(__dirname, 'blog/when-to-overseed-lawn-lincoln-ne.html'),
            },
        },
    },
    server: {
        port: 3000,
        open: true,
    },
});
