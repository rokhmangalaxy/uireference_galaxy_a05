package com.emrobinso.uistylegallery

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test

class VisualBuilderTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun addEditAndRestoreDraft() {
        compose.onNodeWithTag("bottom_nav_3").performClick()
        compose.onNodeWithTag("builder_reset").performClick()
        compose.onNodeWithText("Reset", substring = false).performClick()
        compose.onNodeWithTag("palette_TITLE").performClick()
        compose.onNodeWithTag("builder_edit").performClick()
        compose.onNodeWithTag("builder_text").performTextClearance()
        compose.onNodeWithTag("builder_text").performTextInput("Judul baru")
        compose.onNodeWithText("Selesai").performClick()
        compose.onNodeWithText("Judul baru").assertIsDisplayed()
        compose.activityRule.scenario.recreate()
        compose.waitForIdle()
        compose.onNodeWithText("Judul baru").assertIsDisplayed()
        compose.onNodeWithTag("builder_export").assertIsDisplayed()
    }

    @Test fun draftSurvivesStyleChanges() {
        compose.onNodeWithTag("bottom_nav_3").performClick()
        compose.onNodeWithTag("palette_TEXT").performClick()
        compose.onNodeWithTag("builder_edit").performClick()
        compose.onNodeWithTag("builder_text").performTextClearance()
        compose.onNodeWithTag("builder_text").performTextInput("Desain saya")
        compose.onNodeWithText("Selesai").performClick()
        compose.onNodeWithTag("open_style_menu").performClick()
        // The second row is visible without scrolling in the drawer.
        compose.onNodeWithTag("style_menu_2").performClick()
        compose.onNodeWithTag("toolbar_style").assertTextContains("Dark Mode Elegan")
        compose.onNodeWithText("Desain saya").assertIsDisplayed()
    }
}
