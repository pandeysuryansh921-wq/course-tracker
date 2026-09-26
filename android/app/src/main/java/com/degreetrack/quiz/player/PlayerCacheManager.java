package com.degreetrack.quiz.player;

import android.content.Context;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor;
import androidx.media3.datasource.cache.SimpleCache;
import java.io.File;

public class PlayerCacheManager {
    private static SimpleCache sDownloadCache;
    // 2 GB disk cache for streamed lecture chunks
    private static final long MAX_CACHE_BYTES = 2L * 1024 * 1024 * 1024;

    public static synchronized SimpleCache getCache(Context context) {
        if (sDownloadCache == null) {
            File cacheDir = new File(context.getApplicationContext().getCacheDir(), "degreetrack_media_cache");
            LeastRecentlyUsedCacheEvictor evictor = new LeastRecentlyUsedCacheEvictor(MAX_CACHE_BYTES);
            StandaloneDatabaseProvider databaseProvider = new StandaloneDatabaseProvider(context.getApplicationContext());
            sDownloadCache = new SimpleCache(cacheDir, evictor, databaseProvider);
        }
        return sDownloadCache;
    }
}
