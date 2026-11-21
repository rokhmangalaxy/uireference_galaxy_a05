package com.emrobinso.uistylegallery

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import org.junit.Rule
import org.junit.Test

class StyleGalleryTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    @Test
    fun selectingStyleChangesAppAndPersistsAfterRecreation() {
        compose.onNodeWithTag("open_style_menu").performClick()
        compose.onNodeWithTag("style_menu_8").performScrollTo().performClick()
        compose.onNodeWithTag("current_style").assertTextContains("Brutalist")

        compose.activityRule.scenario.recreate()
        compose.waitForIdle()
        compose.onNodeWithTag("current_style").assertTextContains("Brutalist")
    }

    @Test
    fun changingStyleKeepsFormState() {
        compose.onNodeWithTag("plan_name").performScrollTo().performTextInput("Belajar Compose")
        compose.onNodeWithTag("open_style_menu").performClick()
        compose.onNodeWithTag("style_menu_2").performScrollTo().performClick()
        compose.onNodeWithTag("plan_name").performScrollTo().assertIsDisplayed().assertTextContains("Belajar Compose")
    }
}
