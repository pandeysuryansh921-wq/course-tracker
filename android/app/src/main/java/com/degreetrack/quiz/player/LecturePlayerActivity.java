package com.degreetrack.quiz.player;

import android.app.Activity;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.ui.PlayerView;

import com.degreetrack.quiz.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import android.util.Log;

public class LecturePlayerActivity extends AppCompatActivity {
    private static final String TAG = "LecturePlayerActivity";

    private PlayerView playerView;
    private ExoPlayer player;
    private View controlsOverlay;
    private View topBar;
    private View bottomBar;
    private View centerControls;
    private ProgressBar bufferingProgress;
    private ImageButton btnPlayPause;
    private ImageButton btnRewind;
    private ImageButton btnForward;
    private ImageButton btnBack;
    private LinearLayout btnAddNote;
    private TextView tvCourseTitle;
    private TextView tvLectureTitle;
    private TextView tvBadgeStatus;
    private TextView tvCurrentTime;
    private TextView tvDuration;
    private SeekBar seekbar;
    private LinearLayout speedContainer;
    private LinearLayout resumeBanner;
    private TextView tvResumeLabel;
    private Button btnRestart;
    private ImageButton btnResumeDismiss;
    private LinearLayout btnNextLecture;
    private TextView tvNextLectureName;

    // Lecture Data
    private String fileId;
    private String videoUrl;
    private String accessToken;
    private String lectureTitle;
    private String courseTitle;
    private String topicId;
    private double initialPositionSec = 0;
    private double initialDurationSec = 0;
    private boolean isOffline = false;

    // Up next lecture
    private String nextTopicId;
    private String nextTitle;
    private String nextVideoUrl;
    private String nextFileId;
    private boolean nextRequested = false;

    // State
    private boolean isUserSeeking = false;
    private float currentSpeed = 1.0f;
    private int maxWatchedPct = 0;
    private boolean isCompleted = false;
    private final JSONArray notesAdded = new JSONArray();

    private final Handler handler = new Handler(Looper.getMainLooper());
    private static final int CONTROLS_TIMEOUT_MS = 3500;

    private final Runnable hideControlsRunnable = new Runnable() {
        @Override
        public void run() {
            if (player != null && player.isPlaying() && !isUserSeeking) {
                hideControls();
            }
        }
    };

    private final Runnable progressUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            updateProgress();
            handler.postDelayed(this, 500);
        }
    };

    private static final float[] AVAILABLE_SPEEDS = {0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 1.75f, 2.0f, 2.5f, 3.0f};
    private static final String[] SPEED_LABELS = {"0.5x", "0.75x", "1.0x", "1.25x", "1.5x", "1.75x", "2.0x", "2.5x", "3.0x"};

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "[DegreeTrack] LecturePlayerActivity onCreate launched");

        // Keep screen on & immersive
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setImmersiveMode();

        setContentView(R.layout.activity_lecture_player);

        extractIntentData();
        initViews();
        setupSpeedChips();
        setupListeners();
        initExoPlayer();
    }

    private void setImmersiveMode() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setImmersiveMode();
        }
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Playback continues completely uninterrupted across portrait <-> landscape!
        setImmersiveMode();
    }

    private void extractIntentData() {
        Intent intent = getIntent();
        fileId = intent.getStringExtra("fileId");
        videoUrl = intent.getStringExtra("videoUrl");
        accessToken = intent.getStringExtra("accessToken");
        lectureTitle = intent.getStringExtra("title");
        if (lectureTitle == null || lectureTitle.isEmpty()) lectureTitle = "Lecture Video";
        courseTitle = intent.getStringExtra("courseTitle");
        if (courseTitle == null || courseTitle.isEmpty()) courseTitle = "DegreeTrack";
        topicId = intent.getStringExtra("topicId");
        initialPositionSec = intent.getDoubleExtra("currentTime", 0);
        initialDurationSec = intent.getDoubleExtra("duration", 0);
        isOffline = intent.getBooleanExtra("isOffline", false);

        nextTopicId = intent.getStringExtra("nextTopicId");
        nextTitle = intent.getStringExtra("nextTitle");
        nextVideoUrl = intent.getStringExtra("nextVideoUrl");
        nextFileId = intent.getStringExtra("nextFileId");

        Log.d(TAG, "[DegreeTrack] Intent data parsed: fileId=" + fileId +
                ", videoUrl=" + videoUrl +
                ", hasAccessToken=" + (accessToken != null && !accessToken.trim().isEmpty()) +
                ", lectureTitle=" + lectureTitle +
                ", courseTitle=" + courseTitle +
                ", topicId=" + topicId +
                ", initialPos=" + initialPositionSec +
                ", isOffline=" + isOffline);
    }

    private void initViews() {
        playerView = findViewById(R.id.dt_player_view);
        controlsOverlay = findViewById(R.id.dt_controls_overlay);
        topBar = findViewById(R.id.dt_top_bar);
        bottomBar = findViewById(R.id.dt_bottom_bar);
        centerControls = findViewById(R.id.dt_center_controls);
        bufferingProgress = findViewById(R.id.dt_buffering_progress);
        btnPlayPause = findViewById(R.id.dt_btn_play_pause);
        btnRewind = findViewById(R.id.dt_btn_rewind);
        btnForward = findViewById(R.id.dt_btn_forward);
        btnBack = findViewById(R.id.dt_btn_back);
        btnAddNote = findViewById(R.id.dt_btn_add_note);
        tvCourseTitle = findViewById(R.id.dt_tv_course_title);
        tvLectureTitle = findViewById(R.id.dt_tv_lecture_title);
        tvBadgeStatus = findViewById(R.id.dt_tv_badge_status);
        tvCurrentTime = findViewById(R.id.dt_tv_current_time);
        tvDuration = findViewById(R.id.dt_tv_duration);
        seekbar = findViewById(R.id.dt_seekbar);
        speedContainer = findViewById(R.id.dt_speed_container);
        resumeBanner = findViewById(R.id.dt_resume_banner);
        tvResumeLabel = findViewById(R.id.dt_tv_resume_label);
        btnRestart = findViewById(R.id.dt_btn_restart);
        btnResumeDismiss = findViewById(R.id.dt_btn_resume_dismiss);
        btnNextLecture = findViewById(R.id.dt_btn_next_lecture);
        tvNextLectureName = findViewById(R.id.dt_tv_next_lecture_name);

        tvCourseTitle.setText(courseTitle);
        tvLectureTitle.setText(lectureTitle);

        if (isOffline || (videoUrl != null && (videoUrl.startsWith("file:") || videoUrl.startsWith("/")))) {
            tvBadgeStatus.setText("Offline Ready");
            tvBadgeStatus.setBackgroundResource(R.drawable.bg_dt_pill_offline);
            tvBadgeStatus.setTextColor(0xFF34D399);
        } else {
            tvBadgeStatus.setText("Google Drive Stream");
            tvBadgeStatus.setBackgroundResource(R.drawable.bg_dt_pill_stream);
            tvBadgeStatus.setTextColor(0xFF60A5FA);
        }

        if (nextTitle != null && !nextTitle.isEmpty()) {
            btnNextLecture.setVisibility(View.VISIBLE);
            tvNextLectureName.setText(nextTitle);
        } else {
            btnNextLecture.setVisibility(View.GONE);
        }
    }

    private void setupSpeedChips() {
        speedContainer.removeAllViews();
        for (int i = 0; i < AVAILABLE_SPEEDS.length; i++) {
            final float speed = AVAILABLE_SPEEDS[i];
            final String label = SPEED_LABELS[i];

            TextView chip = new TextView(this);
            chip.setText(label);
            chip.setTextSize(11f);
            chip.setPadding(dpToPx(10), dpToPx(4), dpToPx(10), dpToPx(4));

            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            params.setMarginEnd(dpToPx(6));
            chip.setLayoutParams(params);

            updateSpeedChipVisual(chip, Math.abs(currentSpeed - speed) < 0.05f);

            chip.setOnClickListener(v -> {
                setPlaybackSpeed(speed);
                for (int j = 0; j < speedContainer.getChildCount(); j++) {
                    View child = speedContainer.getChildAt(j);
                    if (child instanceof TextView) {
                        float childSpeed = AVAILABLE_SPEEDS[j];
                        updateSpeedChipVisual((TextView) child, Math.abs(currentSpeed - childSpeed) < 0.05f);
                    }
                }
                resetControlsTimer();
            });

            speedContainer.addView(chip);
        }
    }

    private void updateSpeedChipVisual(TextView chip, boolean isSelected) {
        if (isSelected) {
            chip.setBackgroundResource(R.drawable.bg_dt_speed_chip_selected);
            chip.setTextColor(0xFFFFFFFF);
        } else {
            chip.setBackgroundResource(R.drawable.bg_dt_speed_chip);
            chip.setTextColor(0xFF94A3B8);
        }
    }

    private void setPlaybackSpeed(float speed) {
        currentSpeed = speed;
        if (player != null) {
            player.setPlaybackParameters(new PlaybackParameters(speed));
        }
    }

    private void setupListeners() {
        // Toggle controls overlay on tap
        controlsOverlay.setOnClickListener(v -> {
            if (topBar.getVisibility() == View.VISIBLE) {
                hideControls();
            } else {
                showControls();
            }
        });

        btnPlayPause.setOnClickListener(v -> {
            if (player != null) {
                if (player.isPlaying()) {
                    player.pause();
                    btnPlayPause.setImageResource(R.drawable.ic_dt_play);
                    showControls();
                } else {
                    player.play();
                    btnPlayPause.setImageResource(R.drawable.ic_dt_pause);
                    resetControlsTimer();
                }
            }
        });

        // 10s Rewind
        btnRewind.setOnClickListener(v -> {
            if (player != null) {
                long newPos = Math.max(0, player.getCurrentPosition() - 10000);
                player.seekTo(newPos);
                resetControlsTimer();
            }
        });

        // 10s Fast-Forward
        btnForward.setOnClickListener(v -> {
            if (player != null) {
                long duration = player.getDuration();
                long newPos = duration > 0 ? Math.min(duration, player.getCurrentPosition() + 10000) : player.getCurrentPosition() + 10000;
                player.seekTo(newPos);
                resetControlsTimer();
            }
        });

        btnBack.setOnClickListener(v -> finishAndReturn());

        btnAddNote.setOnClickListener(v -> showAddNoteDialog());

        // Next Lecture Click
        btnNextLecture.setOnClickListener(v -> {
            if (nextTopicId != null && !nextTopicId.isEmpty()) {
                nextRequested = true;
                finishAndReturn();
            }
        });

        // Scrubber
        seekbar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser && player != null) {
                    long duration = player.getDuration();
                    if (duration > 0) {
                        long targetMs = (duration * progress) / 1000;
                        tvCurrentTime.setText(formatTime(targetMs));
                    }
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                isUserSeeking = true;
                handler.removeCallbacks(hideControlsRunnable);
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                isUserSeeking = false;
                if (player != null) {
                    long duration = player.getDuration();
                    if (duration > 0) {
                        long targetMs = (duration * seekBar.getProgress()) / 1000;
                        player.seekTo(targetMs);
                    }
                }
                resetControlsTimer();
            }
        });

        // Resume prompt handlers
        btnRestart.setOnClickListener(v -> {
            if (player != null) {
                player.seekTo(0);
                resumeBanner.setVisibility(View.GONE);
            }
        });

        btnResumeDismiss.setOnClickListener(v -> resumeBanner.setVisibility(View.GONE));
    }

    private void initExoPlayer() {
        if (videoUrl == null || videoUrl.isEmpty()) {
            Log.e(TAG, "[DegreeTrack] Cannot initialize ExoPlayer: videoUrl is null or empty!");
            Toast.makeText(this, "Invalid lecture video URL", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        Log.d(TAG, "[DegreeTrack] Initializing Media3 ExoPlayer: videoUrl=" + videoUrl + 
                ", isOffline=" + isOffline + 
                ", initialPosSec=" + initialPositionSec);

        // Tuned for multi-GB 1-3 hour lectures with fast 2.5s initial buffer
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        25000, // min buffer 25s
                        60000, // max buffer 60s
                        2500,  // initial buffer before playback starts
                        5000   // buffer after rebuffering
                )
                .build();

        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
                .setEnableDecoderFallback(true);

        player = new ExoPlayer.Builder(this, renderersFactory)
                .setLoadControl(loadControl)
                .build();

        playerView.setPlayer(player);
        player.setPlaybackParameters(new PlaybackParameters(currentSpeed));

        // Create MediaSource
        MediaSource mediaSource = buildMediaSource(videoUrl, isOffline);
        player.setMediaSource(mediaSource);

        // Pre-buffer next lecture if available
        if (nextVideoUrl != null && !nextVideoUrl.isEmpty()) {
            Log.d(TAG, "[DegreeTrack] Pre-buffering next lecture: " + nextTitle + " (" + nextVideoUrl + ")");
            MediaSource nextSource = buildMediaSource(nextVideoUrl, false);
            player.addMediaSource(nextSource);
        }

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                switch (playbackState) {
                    case Player.STATE_BUFFERING:
                        Log.d(TAG, "[DegreeTrack] ExoPlayer STATE_BUFFERING");
                        bufferingProgress.setVisibility(View.VISIBLE);
                        break;
                    case Player.STATE_READY:
                        Log.d(TAG, "[DegreeTrack] ExoPlayer STATE_READY (duration=" + player.getDuration() + "ms)");
                        bufferingProgress.setVisibility(View.GONE);
                        updatePlayPauseIcon();
                        updateDurationDisplay();
                        break;
                    case Player.STATE_ENDED:
                        Log.d(TAG, "[DegreeTrack] ExoPlayer STATE_ENDED");
                        bufferingProgress.setVisibility(View.GONE);
                        updatePlayPauseIcon();
                        isCompleted = true;
                        maxWatchedPct = 100;
                        showControls();
                        break;
                    case Player.STATE_IDLE:
                        Log.d(TAG, "[DegreeTrack] ExoPlayer STATE_IDLE");
                        break;
                }
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                Log.d(TAG, "[DegreeTrack] ExoPlayer onIsPlayingChanged: " + isPlaying);
                updatePlayPauseIcon();
                if (isPlaying) {
                    resetControlsTimer();
                } else {
                    showControls();
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                Log.e(TAG, "[DegreeTrack] ExoPlayer onPlayerError: " + error.getMessage() + " (errorCode=" + error.errorCode + ")", error);
                bufferingProgress.setVisibility(View.GONE);
                Toast.makeText(LecturePlayerActivity.this, "Playback error: " + error.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

        // Resume position handling
        if (initialPositionSec > 10) {
            long resumeMs = (long) (initialPositionSec * 1000);
            Log.d(TAG, "[DegreeTrack] Resuming playback from " + resumeMs + "ms (" + initialPositionSec + "s)");
            player.seekTo(resumeMs);
            tvResumeLabel.setText("Resumed from " + formatTime(resumeMs));
            resumeBanner.setVisibility(View.VISIBLE);
            handler.postDelayed(() -> resumeBanner.setVisibility(View.GONE), 6000);
        }

        Log.d(TAG, "[DegreeTrack] Preparing and starting ExoPlayer");
        player.prepare();
        player.play();

        // Start progress polling
        handler.post(progressUpdateRunnable);
        resetControlsTimer();
    }

    private MediaSource buildMediaSource(String uriStr, boolean forceOffline) {
        Uri uri = Uri.parse(uriStr);
        Log.d(TAG, "[DegreeTrack] buildMediaSource for: " + uriStr + ", forceOffline=" + forceOffline);

        if (forceOffline || uriStr.startsWith("file:") || uriStr.startsWith("/")) {
            Log.d(TAG, "[DegreeTrack] Using local DefaultDataSource.Factory for offline file");
            DataSource.Factory localFactory = new DefaultDataSource.Factory(this);
            return new ProgressiveMediaSource.Factory(localFactory).createMediaSource(MediaItem.fromUri(uri));
        } else {
            // Google Drive Streaming with Bearer Auth and SimpleCache
            Log.d(TAG, "[DegreeTrack] Using DefaultHttpDataSource.Factory with CacheDataSource (Bearer auth present: " + (accessToken != null && !accessToken.trim().isEmpty()) + ")");
            DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
                    .setUserAgent("DegreeTrack-ExoPlayer")
                    .setConnectTimeoutMs(15000)
                    .setReadTimeoutMs(30000)
                    .setAllowCrossProtocolRedirects(true);

            if (accessToken != null && !accessToken.trim().isEmpty()) {
                httpFactory.setDefaultRequestProperties(Collections.singletonMap("Authorization", "Bearer " + accessToken.trim()));
            } else {
                Log.w(TAG, "[DegreeTrack] WARNING: No accessToken provided for streaming Google Drive file!");
            }

            CacheDataSource.Factory cacheFactory = new CacheDataSource.Factory()
                    .setCache(PlayerCacheManager.getCache(this))
                    .setUpstreamDataSourceFactory(httpFactory)
                    .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);

            return new ProgressiveMediaSource.Factory(cacheFactory).createMediaSource(MediaItem.fromUri(uri));
        }
    }

    private void updatePlayPauseIcon() {
        if (player != null && player.isPlaying()) {
            btnPlayPause.setImageResource(R.drawable.ic_dt_pause);
        } else {
            btnPlayPause.setImageResource(R.drawable.ic_dt_play);
        }
    }

    private void updateDurationDisplay() {
        if (player != null) {
            long duration = player.getDuration();
            if (duration > 0) {
                tvDuration.setText(formatTime(duration));
            }
        }
    }

    private void updateProgress() {
        if (player == null || isUserSeeking) return;

        long current = player.getCurrentPosition();
        long duration = player.getDuration();

        if (duration > 0) {
            tvCurrentTime.setText(formatTime(current));
            int progress = (int) ((current * 1000) / duration);
            seekbar.setProgress(progress);

            // Watched percentage calculation
            int pct = (int) ((current * 100) / duration);
            if (pct > maxWatchedPct) {
                maxWatchedPct = pct;
                if (maxWatchedPct >= 90) {
                    isCompleted = true;
                }
            }
        }
    }

    private void showControls() {
        topBar.setVisibility(View.VISIBLE);
        bottomBar.setVisibility(View.VISIBLE);
        centerControls.setVisibility(View.VISIBLE);
        resetControlsTimer();
    }

    private void hideControls() {
        topBar.setVisibility(View.GONE);
        bottomBar.setVisibility(View.GONE);
        centerControls.setVisibility(View.GONE);
        resumeBanner.setVisibility(View.GONE);
    }

    private void resetControlsTimer() {
        handler.removeCallbacks(hideControlsRunnable);
        if (player != null && player.isPlaying()) {
            handler.postDelayed(hideControlsRunnable, CONTROLS_TIMEOUT_MS);
        }
    }

    private void showAddNoteDialog() {
        final long noteTimestampMs = player != null ? player.getCurrentPosition() : 0;
        final int noteTimestampSec = (int) (noteTimestampMs / 1000);
        final String formattedTime = formatTime(noteTimestampMs);

        // Pause playback while taking note
        boolean wasPlaying = player != null && player.isPlaying();
        if (wasPlaying) {
            player.pause();
        }

        AlertDialog.Builder builder = new AlertDialog.Builder(this, androidx.appcompat.R.style.Theme_AppCompat_Dialog_Alert);
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_lecture_note, null);
        builder.setView(dialogView);

        final AlertDialog dialog = builder.create();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        TextView tvTimestamp = dialogView.findViewById(R.id.dt_tv_dialog_timestamp);
        final EditText etNote = dialogView.findViewById(R.id.dt_et_note_text);
        Button btnCancel = dialogView.findViewById(R.id.dt_btn_dialog_cancel);
        Button btnSave = dialogView.findViewById(R.id.dt_btn_dialog_save);

        tvTimestamp.setText("Add Note at " + formattedTime);

        btnCancel.setOnClickListener(v -> {
            dialog.dismiss();
            if (wasPlaying && player != null) player.play();
        });

        btnSave.setOnClickListener(v -> {
            String noteText = etNote.getText().toString().trim();
            if (!noteText.isEmpty()) {
                try {
                    JSONObject note = new JSONObject();
                    note.put("id", "note-" + System.currentTimeMillis());
                    note.put("topicId", topicId);
                    note.put("timestampSeconds", noteTimestampSec);
                    note.put("text", noteText);

                    SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                    sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                    note.put("createdAt", sdf.format(new Date()));

                    notesAdded.put(note);
                    Toast.makeText(this, "Note saved at " + formattedTime, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            dialog.dismiss();
            if (wasPlaying && player != null) player.play();
        });

        dialog.setOnDismissListener(d -> {
            if (wasPlaying && player != null && !player.isPlaying()) {
                player.play();
            }
            setImmersiveMode();
        });

        dialog.show();
    }

    private void finishAndReturn() {
        double curSec = player != null ? (player.getCurrentPosition() / 1000.0) : initialPositionSec;
        double durSec = player != null && player.getDuration() > 0 ? (player.getDuration() / 1000.0) : initialDurationSec;

        Log.d(TAG, "[DegreeTrack] finishAndReturn: topicId=" + topicId +
                ", currentTime=" + curSec +
                ", duration=" + durSec +
                ", isCompleted=" + isCompleted +
                ", watchedPercentage=" + maxWatchedPct +
                ", notesCount=" + notesAdded.length() +
                ", nextRequested=" + nextRequested);

        Intent resultIntent = new Intent();
        resultIntent.putExtra("topicId", topicId);
        resultIntent.putExtra("currentTime", curSec);
        resultIntent.putExtra("duration", durSec);
        resultIntent.putExtra("isCompleted", isCompleted);
        resultIntent.putExtra("watchedPercentage", maxWatchedPct);
        resultIntent.putExtra("notesAddedJson", notesAdded.toString());
        resultIntent.putExtra("nextRequested", nextRequested);
        if (nextRequested && nextTopicId != null) {
            resultIntent.putExtra("nextTopicId", nextTopicId);
        }

        setResult(Activity.RESULT_OK, resultIntent);
        finish();
    }

    @Override
    public void onBackPressed() {
        finishAndReturn();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null && player.isPlaying()) {
            player.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        if (player != null) {
            player.release();
            player = null;
        }
    }

    private String formatTime(long ms) {
        long totalSeconds = ms / 1000;
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;

        if (hours > 0) {
            return String.format(Locale.US, "%d:%02d:%02d", hours, minutes, seconds);
        } else {
            return String.format(Locale.US, "%02d:%02d", minutes, seconds);
        }
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
