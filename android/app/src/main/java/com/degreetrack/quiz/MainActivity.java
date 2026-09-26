package com.degreetrack.quiz;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.degreetrack.quiz.player.LecturePlayerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LecturePlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
