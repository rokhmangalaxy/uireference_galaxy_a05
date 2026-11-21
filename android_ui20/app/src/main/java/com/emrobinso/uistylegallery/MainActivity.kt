package com.emrobinso.uistylegallery

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import kotlinx.coroutines.launch

private data class UiStyle(
    val name: String,
    val description: String,
    val primary: Color,
    val background: Color,
    val surface: Color,
    val surfaceVariant: Color,
    val text: Color,
    val muted: Color,
    val icon: ImageVector,
    val radius: Int = 16,
    val font: FontFamily = FontFamily.SansSerif,
    val dark: Boolean = false,
    val border: Boolean = false,
    val elevated: Boolean = false
)

// Each style changes the same controls, making differences easy to compare.
private val styles = listOf(
    UiStyle("Material Design 3", "Adaptif & modern", Color(0xFF6552B5), Color(0xFFF8F7FF), Color.White, Color(0xFFEAE5F8), Color(0xFF211D32), Color(0xFF605B70), Icons.Default.Palette, 20),
    UiStyle("Minimalis", "Bersih & fokus", Color(0xFF374747), Color(0xFFFAFAF8), Color.White, Color(0xFFEDEFEA), Color(0xFF222827), Color(0xFF5D6864), Icons.Default.Remove, 4, border = true),
    UiStyle("Dark Mode Elegan", "Gelap & elegan", Color(0xFFC6B8FF), Color(0xFF14141D), Color(0xFF22222E), Color(0xFF353444), Color(0xFFF4F1FA), Color(0xFFC5BFCE), Icons.Default.DarkMode, 20, dark = true),
    UiStyle("Glassmorphism", "Transparan & lembut", Color(0xFFDCCBFF), Color(0xFF30265D), Color(0xFF51447A), Color(0xFF655891), Color.White, Color(0xFFE1D7F4), Icons.Default.Cloud, 28, dark = true, border = true),
    UiStyle("Neumorphism", "Lembut & timbul", Color(0xFF456985), Color(0xFFE6EDF2), Color(0xFFF0F5F8), Color(0xFFDCE6ED), Color(0xFF263F50), Color(0xFF526B7D), Icons.Default.Tune, 28, elevated = true),
    UiStyle("Bento Grid", "Modular & terstruktur", Color(0xFFAC4B26), Color(0xFFFFF8F2), Color.White, Color(0xFFFFE8DB), Color(0xFF33251F), Color(0xFF745F56), Icons.Default.GridView, 24),
    UiStyle("Flat Design", "Datar & berwarna", Color(0xFFB23D2A), Color(0xFFFFF8E6), Color(0xFFFFE8AF), Color(0xFFBDE1D3), Color(0xFF302921), Color(0xFF695B4D), Icons.Default.WbSunny, 2),
    UiStyle("Gradient Modern", "Warna & gradasi", Color(0xFF8144B1), Color(0xFFFFF7FC), Color.White, Color(0xFFF4E3F8), Color(0xFF302238), Color(0xFF735F77), Icons.Default.AutoAwesome, 24),
    UiStyle("Brutalist", "Tegas & ekspresif", Color(0xFF000000), Color(0xFFFFEB58), Color.White, Color(0xFFFFF59B), Color.Black, Color(0xFF343434), Icons.Default.Bolt, 0, FontFamily.Monospace, border = true),
    UiStyle("Soft UI / Pastel", "Tenang & ramah", Color(0xFF9A507D), Color(0xFFFFF5F8), Color.White, Color(0xFFF8E3ED), Color(0xFF4A3140), Color(0xFF785E6E), Icons.Default.Favorite, 28),
    UiStyle("Editorial", "Tipografi & cerita", Color(0xFF8B5538), Color(0xFFF6F1E9), Color(0xFFFFFCF7), Color(0xFFECE3D7), Color(0xFF302821), Color(0xFF705F53), Icons.Default.MenuBook, 2, FontFamily.Serif, border = true),
    UiStyle("Illustration-First", "Visual & ceria", Color(0xFF3A7956), Color(0xFFF2FAF2), Color.White, Color(0xFFDDF1E1), Color(0xFF203A29), Color(0xFF4D6A56), Icons.Default.Park, 28),
    UiStyle("Card-Based", "Teratur & jelas", Color(0xFF4B66A6), Color(0xFFF0F3F8), Color.White, Color(0xFFE3EAF8), Color(0xFF202C42), Color(0xFF59677E), Icons.Default.ViewAgenda, 18, elevated = true),
    UiStyle("Data-Dense Dashboard", "Data & wawasan", Color(0xFF16785E), Color(0xFFF1F6F4), Color.White, Color(0xFFDFF1EB), Color(0xFF1F3831), Color(0xFF506F64), Icons.Default.BarChart, 6, FontFamily.Monospace, border = true),
    UiStyle("Nature-Inspired", "Organik & alami", Color(0xFF4D7046), Color(0xFFF2F3E9), Color(0xFFFFFEF7), Color(0xFFE0E9D8), Color(0xFF2E3A2B), Color(0xFF62705C), Icons.Default.Spa, 22, FontFamily.Serif),
    UiStyle("Futuristik / Neon", "Digital & neon", Color(0xFF65F2D1), Color(0xFF101125), Color(0xFF1D1E39), Color(0xFF303052), Color(0xFFF3F2FF), Color(0xFFCAC7E8), Icons.Default.Memory, 4, FontFamily.Monospace, dark = true, border = true),
    UiStyle("Retro / Nostalgia", "Hangat & klasik", Color(0xFF9A4A34), Color(0xFFF8EACB), Color(0xFFFFF5DF), Color(0xFFF0D4AE), Color(0xFF54392E), Color(0xFF795C4C), Icons.Default.Radio, 8, FontFamily.Serif, border = true),
    UiStyle("Playful / Gamified", "Seru & penuh hadiah", Color(0xFF8551B1), Color(0xFFFFF8E9), Color.White, Color(0xFFFFE8B9), Color(0xFF43314D), Color(0xFF705D76), Icons.Default.EmojiEvents, 28, elevated = true),
    UiStyle("Premium / Luxury", "Mewah & elegan", Color(0xFFE0C594), Color(0xFF1A1A19), Color(0xFF292824), Color(0xFF3D3A33), Color(0xFFF7F0E5), Color(0xFFD0C4B0), Icons.Default.Diamond, 2, FontFamily.Serif, dark = true, border = true),
    UiStyle("Conversational UI", "Akrab & membantu", Color(0xFF326F84), Color(0xFFF1F8FA), Color.White, Color(0xFFDBEEF2), Color(0xFF20383F), Color(0xFF526D75), Icons.Default.ChatBubble, 26)
)

private fun UiStyle.colorScheme(): ColorScheme {
    val onPrimary = if (primary.luminance() > .42f) Color(0xFF172020) else Color.White
    val factory = if (dark) darkColorScheme() else lightColorScheme()
    return factory.copy(
        primary = primary, onPrimary = onPrimary, primaryContainer = surfaceVariant,
        onPrimaryContainer = text, secondary = primary, onSecondary = onPrimary,
        secondaryContainer = surfaceVariant, onSecondaryContainer = text,
        background = background, onBackground = text, surface = surface, onSurface = text,
        surfaceVariant = surfaceVariant, onSurfaceVariant = muted, surfaceTint = primary,
        surfaceContainerLowest = background, surfaceContainerLow = surface,
        surfaceContainer = surface, surfaceContainerHigh = surfaceVariant, surfaceContainerHighest = surfaceVariant,
        surfaceBright = surface, surfaceDim = background, outline = muted,
        outlineVariant = muted.copy(alpha = .35f), inverseSurface = text,
        inverseOnSurface = background, inversePrimary = primary
    )
}

@Composable
private fun StyleTheme(style: UiStyle, content: @Composable () -> Unit) {
    val base = Typography()
    val typography = base.copy(
        headlineMedium = base.headlineMedium.copy(fontFamily = style.font, fontWeight = FontWeight.Bold),
        headlineSmall = base.headlineSmall.copy(fontFamily = style.font, fontWeight = FontWeight.Bold),
        titleLarge = base.titleLarge.copy(fontFamily = style.font, fontWeight = FontWeight.Bold),
        titleMedium = base.titleMedium.copy(fontFamily = style.font, fontWeight = FontWeight.SemiBold),
        titleSmall = base.titleSmall.copy(fontFamily = style.font, fontWeight = FontWeight.SemiBold),
        bodyLarge = base.bodyLarge.copy(fontFamily = style.font),
        bodyMedium = base.bodyMedium.copy(fontFamily = style.font),
        bodySmall = base.bodySmall.copy(fontFamily = style.font),
        labelLarge = base.labelLarge.copy(fontFamily = style.font, fontWeight = FontWeight.Bold),
        labelMedium = base.labelMedium.copy(fontFamily = style.font),
        labelSmall = base.labelSmall.copy(fontFamily = style.font)
    )
    val shape = RoundedCornerShape(style.radius.dp)
    MaterialTheme(colorScheme = style.colorScheme(), typography = typography,
        shapes = Shapes(extraSmall = shape, small = shape, medium = shape, large = shape, extraLarge = shape), content = content)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Keep normal system bars visible; this is not an immersive/fullscreen app.
        WindowCompat.setDecorFitsSystemWindows(window, true)
        val preferences = getSharedPreferences("ui_style_gallery", MODE_PRIVATE)
        val initialStyle = preferences.getInt("selected_style", 0).coerceIn(styles.indices)
        setContent {
            StyleGalleryApp(initialStyle) { preferences.edit().putInt("selected_style", it).apply() }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StyleGalleryApp(initialStyle: Int = 0, onStyleChanged: (Int) -> Unit = {}) {
    var selected by rememberSaveable { mutableIntStateOf(initialStyle) }
    val style = styles[selected.coerceIn(styles.indices)]
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    StyleTheme(style) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet(modifier = Modifier.widthIn(max = 340.dp), drawerContainerColor = style.surface) {
                    Column(Modifier.fillMaxHeight().safeDrawingPadding()) {
                        Column(Modifier.padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 14.dp)) {
                            Text("UI STYLE GALLERY", style = MaterialTheme.typography.labelMedium, color = style.primary)
                            Spacer(Modifier.height(8.dp))
                            Text("Pilih gaya", style = MaterialTheme.typography.headlineSmall)
                            Spacer(Modifier.height(4.dp))
                            Text("Konten sama, tampilan berbeda.", style = MaterialTheme.typography.bodySmall, color = style.muted)
                        }
                        HorizontalDivider(color = style.muted.copy(alpha = .2f))
                        Column(
                            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 14.dp, vertical = 14.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            styles.indices.chunked(3).forEach { row ->
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    row.forEach { index ->
                                        StylePreviewItem(
                                            style = styles[index], selected = index == selected,
                                            onClick = { selected = index; onStyleChanged(index); scope.launch { drawerState.close() } },
                                            modifier = Modifier.weight(1f).testTag("style_menu_$index")
                                        )
                                    }
                                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                                }
                            }
                        }
                    }
                }
            }
        ) {
            GalleryScreen(
                style = style, index = selected,
                drawerClosed = drawerState.isClosed && drawerState.targetValue == DrawerValue.Closed,
                onMenuClick = { scope.launch { drawerState.open() } }
            )
        }
    }
}

@Composable
private fun StylePreviewItem(style: UiStyle, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val selectionColor = MaterialTheme.colorScheme.primary
    val selectionContent = MaterialTheme.colorScheme.onPrimary
    val frame = RoundedCornerShape(12.dp)
    val miniShape = RoundedCornerShape((style.radius / 3).coerceIn(0, 9).dp)
    Column(
        modifier.semantics(mergeDescendants = true) { contentDescription = style.name }
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(2.dp)
    ) {
        Box(
            Modifier.fillMaxWidth().height(92.dp).clip(frame)
                .background(style.background)
                .border(if (selected) 2.dp else 1.dp, if (selected) selectionColor else MaterialTheme.colorScheme.outlineVariant, frame)
                .padding(7.dp)
        ) {
            Column(Modifier.fillMaxSize()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).background(style.primary, miniShape))
                    Spacer(Modifier.width(4.dp))
                    Box(Modifier.weight(1f).height(4.dp).background(style.text.copy(alpha = .55f), miniShape))
                    Spacer(Modifier.width(18.dp))
                }
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth().weight(1f).clip(miniShape).background(style.surface)) {
                    Column(Modifier.weight(1f).padding(5.dp)) {
                        Box(Modifier.fillMaxWidth(.8f).height(5.dp).background(style.primary, miniShape))
                        Spacer(Modifier.height(4.dp))
                        Box(Modifier.fillMaxWidth().height(3.dp).background(style.muted.copy(alpha = .45f), miniShape))
                        Spacer(Modifier.height(3.dp))
                        Box(Modifier.fillMaxWidth(.7f).height(3.dp).background(style.muted.copy(alpha = .35f), miniShape))
                        Spacer(Modifier.weight(1f))
                        Box(Modifier.width(24.dp).height(8.dp).background(style.primary, miniShape))
                    }
                    Icon(style.icon, contentDescription = null, tint = style.primary, modifier = Modifier.padding(top = 5.dp, end = 5.dp).size(17.dp))
                }
                Spacer(Modifier.height(5.dp))
                Row(Modifier.fillMaxWidth().height(8.dp).background(style.surfaceVariant, miniShape), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                    repeat(3) { i -> Box(Modifier.size(4.dp).background(if (i == 0) style.primary else style.muted.copy(alpha = .5f), RoundedCornerShape(50))) }
                }
            }
            if (selected) {
                Box(Modifier.align(Alignment.TopEnd).size(19.dp).background(selectionColor, RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = selectionContent, modifier = Modifier.size(13.dp))
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(style.name, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface, minLines = 2)
    }
}

private data class BottomDestination(val label: String, val icon: ImageVector)
private val bottomDestinations = listOf(
    BottomDestination("Beranda", Icons.Default.Home),
    BottomDestination("Rencana", Icons.Default.EditNote),
    BottomDestination("Komponen", Icons.Default.Widgets),
    BottomDestination("Builder", Icons.Default.DesignServices)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GalleryScreen(style: UiStyle, index: Int, drawerClosed: Boolean, onMenuClick: () -> Unit) {
    val snackbars = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var destination by rememberSaveable { mutableIntStateOf(0) }
    val scrollStates = listOf(rememberScrollState(), rememberScrollState(), rememberScrollState(), rememberScrollState())
    BackHandler(enabled = destination != 0 && drawerClosed) { destination = 0 }
    var name by rememberSaveable { mutableStateOf("") }
    var selectedCategory by rememberSaveable { mutableStateOf("Desain") }
    var dropdownOpen by remember { mutableStateOf(false) }
    var notifications by rememberSaveable { mutableStateOf(true) }
    var agreed by rememberSaveable { mutableStateOf(false) }
    var selectedPriority by rememberSaveable { mutableStateOf("Normal") }
    var slider by rememberSaveable { mutableFloatStateOf(.65f) }
    var showDialog by rememberSaveable { mutableStateOf(false) }
    var completed by rememberSaveable { mutableStateOf(false) }
    val categories = listOf("Desain", "Produktivitas", "Inspirasi")
    val priorities = listOf("Normal", "Tinggi")
    Scaffold(
        containerColor = style.background,
        snackbarHost = { SnackbarHost(snackbars) },
        bottomBar = {
            NavigationBar(containerColor = style.surface, contentColor = style.text) {
                bottomDestinations.forEachIndexed { i, item ->
                    NavigationBarItem(
                        selected = destination == i,
                        onClick = { destination = i },
                        icon = { Icon(item.icon, contentDescription = null) },
                        label = { Text(item.label, maxLines = 1) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = style.primary, selectedTextColor = style.text,
                            unselectedIconColor = style.muted, unselectedTextColor = style.muted,
                            indicatorColor = style.surfaceVariant
                        ),
                        modifier = Modifier.testTag("bottom_nav_$i")
                    )
                }
            }
        },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("UI Style Gallery", style = MaterialTheme.typography.titleMedium, maxLines = 1)
                        Text(style.name, style = MaterialTheme.typography.bodySmall, color = style.muted, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.testTag("toolbar_style"))
                    }
                },
                navigationIcon = { IconButton(onClick = onMenuClick, modifier = Modifier.testTag("open_style_menu")) { Icon(Icons.Default.Menu, contentDescription = "Buka menu gaya") } },
                actions = { Text("${(index + 1).toString().padStart(2, '0')} / 20", style = MaterialTheme.typography.labelMedium, color = style.muted, modifier = Modifier.padding(end = 18.dp)) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = style.background, titleContentColor = style.text, navigationIconContentColor = style.text)
            )
        }
    ) { insets ->
        if (destination == 3) {
            VisualBuilderScreen(Modifier.fillMaxSize().padding(insets))
        } else {
        Column(
            Modifier.fillMaxSize().padding(insets).verticalScroll(scrollStates[destination.coerceIn(bottomDestinations.indices)])
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Spacer(Modifier.height(2.dp))
            if (destination == 0) {
                HeroCard(style)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Ruang eksplorasi", style = MaterialTheme.typography.headlineSmall, color = style.text)
                        Text("Coba elemen yang sama di setiap gaya.", style = MaterialTheme.typography.bodyMedium, color = style.muted)
                    }
                }
                TabRow(selectedTabIndex = tab, containerColor = style.background, contentColor = style.primary) {
                    listOf("Ringkasan", "Aktivitas").forEachIndexed { i, title ->
                        Tab(selected = tab == i, onClick = { tab = i }, text = { Text(title) })
                    }
                }
                if (tab == 0) {
                    DemoCard(style) {
                        SectionTitle("Progres mingguan", "Contoh kartu, indikator, dan tombol", Icons.Default.Insights)
                        Spacer(Modifier.height(18.dp))
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(if (completed) "100%" else "68%", style = MaterialTheme.typography.headlineMedium, color = style.text)
                            Spacer(Modifier.weight(1f))
                            Text(if (completed) "Selesai" else "4 dari 6 tugas", style = MaterialTheme.typography.bodySmall, color = style.muted)
                        }
                        Spacer(Modifier.height(10.dp))
                        LinearProgressIndicator(progress = { if (completed) 1f else .68f }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)), trackColor = style.surfaceVariant)
                        Spacer(Modifier.height(18.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { completed = !completed }) { Text(if (completed) "Atur ulang" else "Selesaikan") }
                            OutlinedButton(onClick = { showDialog = true }) { Text("Detail") }
                        }
                    }
                } else {
                    DemoCard(style) {
                        SectionTitle("Aktivitas terbaru", "Contoh daftar dan ikon", Icons.Default.History)
                        Spacer(Modifier.height(8.dp))
                        ActivityRow(Icons.Default.CheckCircle, "Membuat rencana", "Hari ini · 09.30", style)
                        HorizontalDivider(color = style.muted.copy(alpha = .2f))
                        ActivityRow(Icons.Default.AutoAwesome, "Mencari inspirasi", "Kemarin · 16.15", style)
                        HorizontalDivider(color = style.muted.copy(alpha = .2f))
                        ActivityRow(Icons.Default.Favorite, "Menyimpan ide", "Senin · 10.00", style)
                    }
                }
            }
            if (destination == 1) {
                Text("Rencana", style = MaterialTheme.typography.headlineSmall, color = style.text)
                Text("Coba formulir dan berbagai kontrol interaktif.", style = MaterialTheme.typography.bodyMedium, color = style.muted)
                DemoCard(style) {
                    SectionTitle("Buat rencana", "Contoh formulir dan pilihan", Icons.Default.EditNote)
                    Spacer(Modifier.height(16.dp))
                    OutlinedTextField(
                        value = name, onValueChange = { name = it },
                        modifier = Modifier.fillMaxWidth().testTag("plan_name"), singleLine = true,
                        label = { Text("Nama rencana") }, placeholder = { Text("Mis. Belajar desain") },
                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) }
                    )
                    Spacer(Modifier.height(12.dp))
                    Box {
                        OutlinedButton(onClick = { dropdownOpen = true }, modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.Category, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp)); Text("Kategori: $selectedCategory", modifier = Modifier.weight(1f)); Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                        }
                        DropdownMenu(expanded = dropdownOpen, onDismissRequest = { dropdownOpen = false }) {
                            categories.forEach { category ->
                                DropdownMenuItem(text = { Text(category) }, onClick = { selectedCategory = category; dropdownOpen = false })
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    Text("Prioritas", style = MaterialTheme.typography.titleSmall)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        priorities.forEach { priority ->
                            Row(Modifier.weight(1f).clickable { selectedPriority = priority }, verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(selected = selectedPriority == priority, onClick = { selectedPriority = priority })
                                Text(priority, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) { Text("Pengingat", style = MaterialTheme.typography.titleSmall); Text("Aktifkan notifikasi contoh", style = MaterialTheme.typography.bodySmall, color = style.muted) }
                        Switch(checked = notifications, onCheckedChange = { notifications = it })
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Target harian", modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                        Text("${(slider * 100).toInt()}%", color = style.primary, style = MaterialTheme.typography.labelLarge)
                    }
                    Slider(value = slider, onValueChange = { slider = it })
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().clickable { agreed = !agreed }) {
                        Checkbox(checked = agreed, onCheckedChange = { agreed = it })
                        Text("Saya siap memulai", style = MaterialTheme.typography.bodyMedium)
                    }
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = {
                        val message = if (name.isBlank()) "Isi nama rencana terlebih dahulu." else if (!agreed) "Centang kesiapan terlebih dahulu." else "Rencana ‘${name.trim()}’ siap sebagai contoh."
                        scope.launch { snackbars.showSnackbar(message) }
                    }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.Add, contentDescription = null); Spacer(Modifier.width(8.dp)); Text("Simpan rencana")
                    }
                }
            }
            if (destination == 2) {
                Text("Komponen", style = MaterialTheme.typography.headlineSmall, color = style.text)
                Text("Elemen yang sama dalam berbagai gaya.", style = MaterialTheme.typography.bodyMedium, color = style.muted)
                DemoCard(style) {
                    SectionTitle("Jelajahi komponen", "Contoh chip, ikon, dan pesan", Icons.Default.Widgets)
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = selectedCategory == "Desain", onClick = { selectedCategory = "Desain" }, label = { Text("Desain") })
                        FilterChip(selected = selectedCategory == "Inspirasi", onClick = { selectedCategory = "Inspirasi" }, label = { Text("Inspirasi") })
                    }
                    Spacer(Modifier.height(8.dp))
                    Surface(color = style.surfaceVariant, shape = MaterialTheme.shapes.medium) {
                        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = style.primary)
                            Spacer(Modifier.width(12.dp))
                            Text("Data di halaman ini hanya contoh lokal.", style = MaterialTheme.typography.bodySmall, color = style.text)
                        }
                    }
                }
            }
            Text("BUKA MENU ☰ UNTUK MEMBANDINGKAN 20 GAYA", style = MaterialTheme.typography.labelSmall, color = style.muted, modifier = Modifier.padding(bottom = 26.dp))
        }
        }
    }
    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            icon = { Icon(Icons.Default.Insights, contentDescription = null) },
            title = { Text("Progres mingguan") },
            text = { Text("Ini adalah contoh dialog. Gunakan menu gaya untuk membandingkan tampilan komponen yang sama.") },
            confirmButton = { TextButton(onClick = { showDialog = false }) { Text("Mengerti") } }
        )
    }
}

@Composable
private fun HeroCard(style: UiStyle) {
    val onPrimary = MaterialTheme.colorScheme.onPrimary
    val endColor = androidx.compose.ui.graphics.lerp(style.primary, onPrimary, .12f)
    val shape = MaterialTheme.shapes.large
    Column(
        Modifier.fillMaxWidth().clip(shape)
            .background(Brush.linearGradient(listOf(style.primary, endColor)))
            .padding(20.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("DESIGN PLAYGROUND", style = MaterialTheme.typography.labelSmall, color = onPrimary.copy(alpha = .85f), modifier = Modifier.weight(1f))
            Icon(style.icon, contentDescription = null, tint = onPrimary, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.height(18.dp))
        Text(style.name, style = MaterialTheme.typography.headlineSmall, color = onPrimary, modifier = Modifier.testTag("current_style"))
        Spacer(Modifier.height(4.dp))
        Text(style.description, style = MaterialTheme.typography.bodyMedium, color = onPrimary.copy(alpha = .85f))
        Spacer(Modifier.height(16.dp))
        Text("20 GAYA  ·  SATU APLIKASI", style = MaterialTheme.typography.labelSmall, color = onPrimary.copy(alpha = .85f))
        StyleSignature(style, onPrimary)
    }
}

@Composable
private fun StyleSignature(style: UiStyle, foreground: Color) {
    when (style.name) {
        "Bento Grid" -> {
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("IDE", "TUGAS", "TARGET").forEach { label ->
                    Box(Modifier.weight(1f).height(45.dp).clip(RoundedCornerShape(12.dp)).background(foreground.copy(alpha = .18f)), contentAlignment = Alignment.Center) {
                        Text(label, style = MaterialTheme.typography.labelSmall, color = foreground)
                    }
                }
            }
        }
        "Illustration-First", "Nature-Inspired" -> {
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Icon(Icons.Default.Park, null, tint = foreground.copy(alpha = .7f), modifier = Modifier.size(46.dp))
                Icon(Icons.Default.WbSunny, null, tint = foreground.copy(alpha = .9f), modifier = Modifier.size(32.dp))
                Icon(Icons.Default.Park, null, tint = foreground.copy(alpha = .5f), modifier = Modifier.size(56.dp))
            }
        }
        "Data-Dense Dashboard", "Futuristik / Neon" -> {
            Spacer(Modifier.height(14.dp))
            Row(Modifier.height(42.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                listOf(17, 31, 22, 40, 27, 35, 42).forEach { height ->
                    Box(Modifier.width(14.dp).height(height.dp).background(foreground.copy(alpha = .6f), RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp)))
                }
            }
        }
        "Conversational UI" -> {
            Spacer(Modifier.height(14.dp))
            Text("Halo, mulai eksplorasi?", color = foreground, style = MaterialTheme.typography.bodySmall, modifier = Modifier.clip(RoundedCornerShape(18.dp)).background(foreground.copy(alpha = .16f)).padding(horizontal = 12.dp, vertical = 8.dp))
        }
    }
}

@Composable
private fun DemoCard(style: UiStyle, content: @Composable ColumnScope.() -> Unit) {
    val shape = MaterialTheme.shapes.large
    Surface(
        modifier = Modifier.fillMaxWidth().then(if (style.border) Modifier.border(if (style.name == "Brutalist") 2.dp else 1.dp, style.muted.copy(alpha = .55f), shape) else Modifier),
        shape = shape, color = style.surface, tonalElevation = 0.dp,
        shadowElevation = if (style.elevated) 4.dp else 0.dp
    ) { Column(Modifier.padding(18.dp), content = content) }
}

@Composable
private fun SectionTitle(title: String, subtitle: String, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(10.dp).size(22.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column { Text(title, style = MaterialTheme.typography.titleMedium); Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun ActivityRow(icon: ImageVector, title: String, subtitle: String, style: UiStyle) {
    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = style.primary, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Column { Text(title, style = MaterialTheme.typography.titleSmall); Text(subtitle, style = MaterialTheme.typography.bodySmall, color = style.muted) }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable private fun MaterialPreview() { StyleGalleryApp() }

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable private fun NeonPreview() { StyleGalleryApp(initialStyle = 15) }

@Preview(showBackground = true, widthDp = 340, heightDp = 160)
@Composable private fun StyleGridItemPreview() {
    StyleTheme(styles[0]) {
        Row(Modifier.fillMaxWidth().background(styles[0].surface).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StylePreviewItem(styles[0], selected = true, onClick = {}, modifier = Modifier.weight(1f))
            StylePreviewItem(styles[2], selected = false, onClick = {}, modifier = Modifier.weight(1f))
            StylePreviewItem(styles[8], selected = false, onClick = {}, modifier = Modifier.weight(1f))
        }
    }
}
