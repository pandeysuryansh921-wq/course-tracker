package com.degreetrack.quiz;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.degreetrack.quiz.player.LecturePlayerPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.d(TAG, "[DegreeTrack] MainActivity onCreate started, registering LecturePlayerPlugin...");
        registerPlugin(LecturePlayerPlugin.class);
        super.onCreate(savedInstanceState);
        Log.d(TAG, "[DegreeTrack] MainActivity onCreate complete. Bridge initialized: " + (getBridge() != null));
    }
}
