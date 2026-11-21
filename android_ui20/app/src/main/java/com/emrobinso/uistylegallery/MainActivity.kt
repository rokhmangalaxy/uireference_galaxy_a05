package com.emrobinso.uistylegallery

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF202239)
private val Muted = Color(0xFF77798B)
private val Purple = Color(0xFF6854E8)
private val Paper = Color(0xFFF7F7FB)

private data class Style(val name: String, val category: String, val accent: Color, val icon: ImageVector)
private val styles = listOf(
    Style("Material Design 3", "ADAPTIVE · MODERN", Color(0xFF7155C6), Icons.Default.Palette),
    Style("Minimalis", "SIMPLE · FOCUSED", Color(0xFF555B5B), Icons.Default.Remove),
    Style("Dark Mode Elegan", "DARK · REFINED", Color(0xFF685CC3), Icons.Default.DarkMode),
    Style("Glassmorphism", "GLASS · DREAMY", Color(0xFF8B77DC), Icons.Default.Cloud),
    Style("Neumorphism", "SOFT · TACTILE", Color(0xFF7C9DB7), Icons.Default.Tune),
    Style("Bento Grid", "MODULAR · SMART", Color(0xFFEF8A58), Icons.Default.GridView),
    Style("Flat Design", "BOLD · SIMPLE", Color(0xFFEE7755), Icons.Default.WbSunny),
    Style("Gradient Modern", "COLORFUL · FLUID", Color(0xFFDD77BB), Icons.Default.AutoAwesome),
    Style("Brutalist", "RAW · EXPRESSIVE", Color(0xFFE4A800), Icons.Default.Bolt),
    Style("Soft UI / Pastel", "CALM · FRIENDLY", Color(0xFFC18BAF), Icons.Default.Favorite),
    Style("Editorial", "TYPE · STORY", Color(0xFFA27859), Icons.Default.MenuBook),
    Style("Illustration-First", "VISUAL · PLAYFUL", Color(0xFF6CA58B), Icons.Default.Park),
    Style("Card-Based", "ORGANIZED · CLEAR", Color(0xFF728CCD), Icons.Default.ViewAgenda),
    Style("Data-Dense Dashboard", "DATA · INSIGHT", Color(0xFF35A58C), Icons.Default.BarChart),
    Style("Nature-Inspired", "ORGANIC · CALM", Color(0xFF708D65), Icons.Default.Spa),
    Style("Futuristik / Neon", "NEON · DIGITAL", Color(0xFF6B5BE8), Icons.Default.Memory),
    Style("Retro / Nostalgia", "VINTAGE · WARM", Color(0xFFCF765C), Icons.Default.Radio),
    Style("Playful / Gamified", "FUN · REWARDING", Color(0xFFF0AA44), Icons.Default.EmojiEvents),
    Style("Premium / Luxury", "ELEGANT · QUIET", Color(0xFFAA8D5F), Icons.Default.Diamond),
    Style("Conversational UI", "CHAT · HELPFUL", Color(0xFF5D95AB), Icons.Default.ChatBubble)
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { GalleryApp() } }
    }
}

@Composable
private fun GalleryApp() {
    var selected by rememberSaveable { mutableIntStateOf(-1) }
    BackHandler(enabled = selected >= 0) { selected = -1 }
    if (selected in styles.indices) StyleDetail(selected) { selected = -1 }
    else Gallery { selected = it }
}

@Composable
private fun Gallery(onSelect: (Int) -> Unit) {
    Column(Modifier.fillMaxSize().background(Paper).safeDrawingPadding()) {
        Column(Modifier.padding(start = 24.dp, end = 24.dp, top = 28.dp, bottom = 20.dp)) {
            Text("THE DESIGN COLLECTION", color = Purple, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 2.sp)
            Spacer(Modifier.height(10.dp))
            Text("UI Style Gallery", color = Ink, fontSize = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp)
            Spacer(Modifier.height(6.dp))
            Text("20 gaya, satu tempat. Temukan inspirasi untuk aplikasi berikutnya.", color = Muted, fontSize = 14.sp, lineHeight = 21.sp)
            Spacer(Modifier.height(22.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("JELAJAHI GAYA", color = Ink, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
                Spacer(Modifier.weight(1f))
                Text("20 KOLEKSI", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            itemsIndexed(styles) { index, style ->
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White)
                        .clickable { onSelect(index) }.padding(14.dp)
                ) {
                    Box(Modifier.fillMaxWidth().height(76.dp).clip(RoundedCornerShape(14.dp)).background(style.accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
                        Icon(style.icon, contentDescription = null, tint = style.accent, modifier = Modifier.size(30.dp))
                    }
                    Spacer(Modifier.height(13.dp))
                    Text("${(index + 1).toString().padStart(2, '0')}  /  ${style.category}", color = style.accent, fontSize = 8.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    Spacer(Modifier.height(5.dp))
                    Text(style.name, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, lineHeight = 18.sp)
                }
            }
        }
    }
}

@Composable
private fun StyleDetail(index: Int, onBack: () -> Unit) {
    val dark = index in listOf(2, 3, 15, 18)
    val background = when (index) {
        2 -> Color(0xFF15151F); 3 -> Color(0xFF35286E); 4 -> Color(0xFFE8EDF2)
        8 -> Color(0xFFFFED65); 9 -> Color(0xFFFFF5F8); 10 -> Color(0xFFF5F1E9)
        12 -> Color(0xFFF3F5F8); 13 -> Color(0xFFF2F6F5); 14 -> Color(0xFFF2F2E8)
        15 -> Color(0xFF101124); 16 -> Color(0xFFF6E8C8); 17 -> Color(0xFFFFF7E5)
        18 -> Color(0xFF1B1B19); 19 -> Color(0xFFF4F8FA); else -> Color(0xFFFAFAFC)
    }
    val foreground = if (dark) Color.White else Ink
    Column(Modifier.fillMaxSize().background(background).safeDrawingPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = foreground) }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("STYLE ${(index + 1).toString().padStart(2, '0')} / 20", color = foreground.copy(alpha = .6f), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Text(styles[index].name, color = foreground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
            Icon(styles[index].icon, contentDescription = null, tint = foreground.copy(alpha = .65f), modifier = Modifier.size(21.dp))
            Spacer(Modifier.width(8.dp))
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 18.dp)) {
            when (index) {
                0 -> MaterialSample(); 1 -> MinimalSample(); 2 -> DarkSample(); 3 -> GlassSample()
                4 -> NeumorphicSample(); 5 -> BentoSample(); 6 -> FlatSample(); 7 -> GradientSample()
                8 -> BrutalSample(); 9 -> PastelSample(); 10 -> EditorialSample(); 11 -> IllustrationSample()
                12 -> CardSample(); 13 -> DashboardSample(); 14 -> NatureSample(); 15 -> NeonSample()
                16 -> RetroSample(); 17 -> PlayfulSample(); 18 -> LuxurySample(); 19 -> ChatSample()
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable private fun Label(text: String, color: Color = Muted) = Text(text, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp)
@Composable private fun Heading(text: String, color: Color = Ink, size: Int = 30) = Text(text, color = color, fontSize = size.sp, fontWeight = FontWeight.Bold, lineHeight = (size + 5).sp, letterSpacing = (-.7).sp)
@Composable private fun Body(text: String, color: Color = Muted) = Text(text, color = color, fontSize = 14.sp, lineHeight = 21.sp)
@Composable private fun Gap(height: Int = 16) = Spacer(Modifier.height(height.dp))

@Composable
private fun Tile(modifier: Modifier = Modifier, color: Color = Color.White, radius: Int = 22, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.clip(RoundedCornerShape(radius.dp)).background(color).padding(20.dp), content = content)
}
@Composable
private fun Pill(text: String, color: Color, textColor: Color = Color.White) {
    Text(text, modifier = Modifier.clip(RoundedCornerShape(50)).background(color).padding(horizontal = 17.dp, vertical = 11.dp), color = textColor, fontSize = 12.sp, fontWeight = FontWeight.Bold)
}
@Composable
private fun ProgressLine(fraction: Float, color: Color, track: Color = Color(0xFFE7E7EF)) {
    Box(Modifier.fillMaxWidth().height(8.dp).clip(CircleShape).background(track)) {
        Box(Modifier.fillMaxWidth(fraction).fillMaxHeight().clip(CircleShape).background(color))
    }
}

@Composable private fun MaterialSample() {
    Label("SELAMAT PAGI", Purple); Gap(8); Heading("Harimu, lebih teratur."); Gap(8)
    Body("Rencanakan hal-hal kecil untuk mencapai tujuan besar."); Gap(24)
    Tile(color = Color(0xFFE9E0FF)) {
        Icon(Icons.Default.AutoAwesome, null, tint = Purple); Gap(18)
        Heading("3 tugas selesai", size = 23); Gap(6); Body("Kamu sudah melakukan pekerjaan yang hebat.", Ink); Gap(18)
        Pill("Lihat aktivitas  →", Purple)
    }; Gap()
    Label("HARI INI"); Gap(10)
    Tile { Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.CheckCircle, null, tint = Purple); Spacer(Modifier.width(12.dp)); Column { Text("Rencanakan minggu ini", fontWeight = FontWeight.Bold); Body("09.00 · Produktivitas") } } }
}
@Composable private fun MinimalSample() {
    Label("MONDAY  /  08:30", Color.DarkGray); Gap(36); Heading("Less, but\nbetter.", size = 38); Gap(12)
    Body("Fokus pada hal yang benar-benar penting."); Gap(38)
    listOf("01" to "Mulai hari dengan tenang", "02" to "Selesaikan satu hal penting", "03" to "Ambil waktu untuk istirahat").forEach { (n, s) ->
        HorizontalDivider(color = Color.LightGray); Row(Modifier.fillMaxWidth().padding(vertical = 20.dp)) { Text(n, color = Muted, fontSize = 12.sp); Spacer(Modifier.width(22.dp)); Text(s, color = Ink, fontSize = 15.sp) }
    }; HorizontalDivider(color = Color.LightGray); Gap(28); Text("TODAY  →", fontWeight = FontWeight.Bold, letterSpacing = 2.sp, fontSize = 12.sp)
}
@Composable private fun DarkSample() {
    Label("YOUR LIBRARY", Color(0xFFAAA5D4)); Gap(12); Heading("Temukan\nritmemu.", Color.White, 34); Gap(20)
    Box(Modifier.fillMaxWidth().height(210.dp).clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(Color(0xFF8D76D7), Color(0xFF353053)))), contentAlignment = Alignment.Center) {
        Icon(Icons.Default.GraphicEq, null, tint = Color.White.copy(alpha = .8f), modifier = Modifier.size(96.dp))
    }; Gap(20); Text("Midnight frequencies", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold); Gap(5); Body("Playlist · 24 lagu", Color.LightGray); Gap(20)
    ProgressLine(.58f, Color(0xFFAF9BFF), Color(0xFF3A3945)); Gap(16)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.SkipPrevious, null, tint = Color.White); Icon(Icons.Default.PlayCircle, null, tint = Color.White, modifier = Modifier.size(52.dp)); Icon(Icons.Default.SkipNext, null, tint = Color.White) }
}
@Composable private fun GlassSample() {
    Label("WEATHER / TODAY", Color.White.copy(alpha = .7f)); Gap(24); Heading("Bandung", Color.White, 34); Body("Selasa, 18 Juni", Color.White.copy(alpha = .7f)); Gap(35)
    Box(Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(28.dp)).background(Brush.linearGradient(listOf(Color(0xFFBB8AF6), Color(0xFF6D9CE0)))), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Default.Cloud, null, tint = Color.White, modifier = Modifier.size(46.dp)); Text("24°", color = Color.White, fontSize = 64.sp, fontWeight = FontWeight.Light); Text("Berawan sebagian", color = Color.White) }
    }; Gap()
    Tile(color = Color.White.copy(alpha = .14f)) { Label("PRAKIRAAN HARI INI", Color.White.copy(alpha = .7f)); Gap(20); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { listOf("10 AM" to "24°", "12 PM" to "27°", "2 PM" to "26°").forEach { (time, temp) -> Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(time, color = Color.White.copy(alpha = .7f), fontSize = 12.sp); Gap(8); Icon(Icons.Default.WbSunny, null, tint = Color(0xFFFFD890)); Gap(8); Text(temp, color = Color.White, fontWeight = FontWeight.Bold) } } } }
}
@Composable private fun NeumorphicSample() {
    Label("SMART HOME", Color(0xFF718396)); Gap(12); Heading("Suasana ruang", Color(0xFF53677B)); Gap(8); Body("Atur kenyamanan di rumah.", Color(0xFF8493A2)); Gap(28)
    Tile(color = Color(0xFFF4F7FA), radius = 30) {
        Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Lightbulb, null, tint = Color(0xFFE3B663), modifier = Modifier.size(34.dp)); Spacer(Modifier.width(12.dp)); Column { Text("Lampu ruang tamu", color = Ink, fontWeight = FontWeight.Bold); Body("Menyala · hangat") } }; Gap(28)
        Label("KECERAHAN"); Gap(15); ProgressLine(.7f, Color(0xFF8FA8BE), Color(0xFFDCE4EB)); Gap(10); Text("70%", color = Color(0xFF718396), fontWeight = FontWeight.Bold)
    }; Gap(18); Tile(color = Color(0xFFDDE5ED), radius = 30) { Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Thermostat, null, tint = Color(0xFF718DA4)); Spacer(Modifier.width(12.dp)); Text("Suhu ruangan", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, color = Ink); Text("24°", fontSize = 24.sp, color = Ink) } }
}
@Composable private fun BentoSample() {
    Label("YOUR DAY", Color(0xFFDB7B52)); Gap(10); Heading("Halo, Sarah 👋"); Gap(8); Body("Semua yang kamu butuhkan, sekilas."); Gap(24)
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Tile(Modifier.weight(1f).height(170.dp), Color(0xFFFFE5D6)) { Icon(Icons.Default.WbSunny, null, tint = Color(0xFFE9894E)); Spacer(Modifier.weight(1f)); Heading("26°", size = 30); Body("Cerah hari ini", Ink) }
        Tile(Modifier.weight(1f).height(170.dp), Color(0xFFE8E4FF)) { Icon(Icons.Default.Favorite, null, tint = Purple); Spacer(Modifier.weight(1f)); Heading("7.2k", size = 28); Body("Langkah", Ink) }
    }; Gap(12)
    Tile(Modifier.fillMaxWidth(), Color(0xFFE1F0E5)) { Label("AKTIVITAS BERIKUTNYA", Color(0xFF628B6B)); Gap(14); Heading("Yoga sore", size = 21); Gap(4); Body("17.30 · 30 menit", Ink) }; Gap(12)
    Tile(Modifier.fillMaxWidth(), Color.White) { Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF85B098)); Spacer(Modifier.width(12.dp)); Text("4 dari 6 target tercapai", fontWeight = FontWeight.Bold) } }
}
@Composable private fun FlatSample() {
    Label("TRAVEL MADE SIMPLE", Color(0xFFE56B53)); Gap(12); Heading("Ke mana\nhari ini?", size = 36); Gap(20)
    Tile(Modifier.fillMaxWidth(), Color(0xFFFFD55F), 8) { Icon(Icons.Default.WbSunny, null, tint = Color(0xFFEC7256), modifier = Modifier.size(55.dp)); Gap(26); Heading("Jelajahi Bali", size = 25); Gap(6); Body("Temukan tempat favoritmu berikutnya.", Ink); Gap(16); Pill("LIHAT TEMPAT  →", Color(0xFFEF755A)) }; Gap()
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { Tile(Modifier.weight(1f), Color(0xFFB7E0D3), 8) { Icon(Icons.Default.Park, null, tint = Ink); Gap(10); Text("Alam", fontWeight = FontWeight.Bold) }; Tile(Modifier.weight(1f), Color(0xFFB6CDF1), 8) { Icon(Icons.Default.Restaurant, null, tint = Ink); Gap(10); Text("Kuliner", fontWeight = FontWeight.Bold) } }
}
@Composable private fun GradientSample() {
    Label("CREATIVE SPACE", Purple); Gap(10); Heading("Ide baru dimulai di sini."); Gap(20)
    Box(Modifier.fillMaxWidth().height(245.dp).clip(RoundedCornerShape(28.dp)).background(Brush.linearGradient(listOf(Color(0xFF705BEB), Color(0xFFDA79C7), Color(0xFFFFB97E)))).padding(24.dp)) {
        Column(Modifier.align(Alignment.BottomStart)) { Icon(Icons.Default.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(36.dp)); Gap(18); Heading("Buat sesuatu\nyang indah.", Color.White, 26); Gap(8); Text("Ruang untuk semua idemu.", color = Color.White) }
    }; Gap(20); Tile { Label("PROYEK TERAKHIR"); Gap(12); Text("Moodboard musim panas", fontWeight = FontWeight.Bold); Gap(6); Body("Diperbarui hari ini") }
}
@Composable private fun BrutalSample() {
    Label("INDEPENDENT CULTURE / 2025", Color.Black); Gap(24)
    Text("MAKE\nSOME\nNOISE.", color = Color.Black, fontSize = 55.sp, lineHeight = 53.sp, fontWeight = FontWeight.Black, letterSpacing = (-3).sp)
    Gap(24); Box(Modifier.fillMaxWidth().border(3.dp, Color.Black).background(Color.White).padding(20.dp)) {
        Column { Label("ISSUE 001", Color.Black); Gap(12); Text("IDEAS DON'T HAVE TO BE QUIET.", fontSize = 21.sp, lineHeight = 25.sp, fontWeight = FontWeight.Black, color = Color.Black); Gap(20); Text("ART  /  DESIGN  /  PEOPLE", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Color.Black) }
    }; Gap(20); Text("EXPLORE THE ISSUE  ↗", modifier = Modifier.background(Color.Black).padding(16.dp), color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
}
@Composable private fun PastelSample() {
    Label("A LITTLE MOMENT FOR YOU", Color(0xFFB37A9F)); Gap(12); Heading("Bagaimana\nperasaanmu?", Color(0xFF6A5366)); Gap(8); Body("Apa pun jawabannya, kamu baik-baik saja.", Color(0xFF9A8191)); Gap(28)
    Tile(Modifier.fillMaxWidth(), Color(0xFFFBE4EE), 28) {
        Icon(Icons.Default.Favorite, null, tint = Color(0xFFD08FAC), modifier = Modifier.size(42.dp)); Gap(20); Heading("Tarik napas pelan.", Color(0xFF6A5366), 22); Gap(8); Body("Luangkan satu menit hanya untuk dirimu.", Color(0xFF8D7283)); Gap(20); Pill("Mulai refleksi", Color(0xFFB97EA2))
    }; Gap(18); Label("CHECK-IN HARI INI", Color(0xFFB37A9F)); Gap(12)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { listOf("😊", "😌", "😐", "😴", "🥰").forEach { Text(it, fontSize = 28.sp) } }
}
@Composable private fun EditorialSample() {
    Text("THE SLOW JOURNAL", color = Color(0xFF795E4D), fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, letterSpacing = 2.sp, fontSize = 12.sp)
    Gap(20); HorizontalDivider(color = Color(0xFFB9A99C)); Gap(28); Label("LIVING WELL  /  6 MIN READ", Color(0xFF9F755B)); Gap(14)
    Text("The art of\ndoing less.", color = Color(0xFF302A26), fontFamily = FontFamily.Serif, fontSize = 43.sp, lineHeight = 48.sp); Gap(18)
    Body("Sebuah catatan tentang menemukan keindahan dalam rutinitas yang sederhana.", Color(0xFF786D65)); Gap(24)
    Box(Modifier.fillMaxWidth().height(190.dp).background(Color(0xFFD7C2AB)), contentAlignment = Alignment.Center) { Icon(Icons.Default.Spa, null, tint = Color(0xFF8B9A7A), modifier = Modifier.size(95.dp)) }
    Gap(14); Text("WORDS BY ANNA W.  ·  JUNE 2025", color = Color(0xFF8B7B70), fontSize = 10.sp, letterSpacing = 1.sp); Gap(20); HorizontalDivider(color = Color(0xFFB9A99C))
}
@Composable private fun IllustrationSample() {
    Label("LITTLE ADVENTURES", Color(0xFF6E9D7F)); Gap(12); Heading("Dunia menunggu\nuntuk dijelajahi."); Gap(10); Body("Belajar tentang alam bisa menyenangkan!"); Gap(24)
    Box(Modifier.fillMaxWidth().height(250.dp).clip(RoundedCornerShape(28.dp)).background(Color(0xFFE5F2E8)), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.WbSunny, null, tint = Color(0xFFF2C76D), modifier = Modifier.size(45.dp))
            Row(verticalAlignment = Alignment.Bottom) { Icon(Icons.Default.Park, null, tint = Color(0xFF79B390), modifier = Modifier.size(76.dp)); Icon(Icons.Default.Pets, null, tint = Color(0xFFDCA87C), modifier = Modifier.size(90.dp)); Icon(Icons.Default.Park, null, tint = Color(0xFF9BC4A0), modifier = Modifier.size(60.dp)) }
            Text("LET'S GO OUTSIDE", color = Color(0xFF608E70), fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 2.sp)
        }
    }; Gap(22); Pill("Mulai petualangan  →", Color(0xFF6DAB84))
}
@Composable private fun CardSample() {
    Label("EXPLORE THE CITY", Color(0xFF7087C2)); Gap(10); Heading("Pilihan untukmu"); Gap(8); Body("Tempat menarik di sekitar kota."); Gap(22)
    listOf(Triple("Kopi di sudut kota", "Kafe · 1,2 km", Color(0xFFF0D9C7)), Triple("Taman kota baru", "Alam · 2,4 km", Color(0xFFD7E9DB)), Triple("Ruang baca bersama", "Budaya · 3,1 km", Color(0xFFDDE2F4))).forEachIndexed { i, (title, sub, color) ->
        Tile(Modifier.fillMaxWidth(), Color.White, 18) { Row(verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(66.dp).clip(RoundedCornerShape(14.dp)).background(color), contentAlignment = Alignment.Center) { Icon(listOf(Icons.Default.LocalCafe, Icons.Default.Park, Icons.Default.MenuBook)[i], null, tint = Ink.copy(alpha = .6f)) }; Spacer(Modifier.width(14.dp)); Column { Text(title, color = Ink, fontWeight = FontWeight.Bold); Gap(5); Body(sub) } } }; Gap(12)
    }
}
@Composable private fun DashboardSample() {
    Label("OVERVIEW", Color(0xFF569E8B)); Gap(10); Heading("Ringkasan bisnis", size = 27); Gap(6); Body("Performa minggu ini"); Gap(22)
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { Tile(Modifier.weight(1f), Color.White, 16) { Label("PENDAPATAN"); Gap(10); Heading("Rp 8,4 jt", size = 20); Gap(5); Text("↑ 12,4%", color = Color(0xFF39A582), fontSize = 12.sp, fontWeight = FontWeight.Bold) }; Tile(Modifier.weight(1f), Color.White, 16) { Label("PESANAN"); Gap(10); Heading("248", size = 20); Gap(5); Text("↑ 8,2%", color = Color(0xFF39A582), fontSize = 12.sp, fontWeight = FontWeight.Bold) } }; Gap(12)
    Tile(Modifier.fillMaxWidth(), Color.White, 16) { Label("PENDAPATAN HARIAN"); Gap(20); Row(Modifier.fillMaxWidth().height(115.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.Bottom) { listOf(45, 70, 55, 90, 65, 105, 82).forEach { h -> Box(Modifier.width(22.dp).height(h.dp).clip(RoundedCornerShape(topStart = 5.dp, topEnd = 5.dp)).background(Color(0xFF71BDA8))) } }; Gap(10); Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) { listOf("S", "S", "R", "K", "J", "S", "M").forEach { Text(it, color = Muted, fontSize = 10.sp) } } }; Gap(12)
    Tile(Modifier.fillMaxWidth(), Color.White, 16) { Row { Text("Target bulanan", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, fontSize = 14.sp); Text("72%", color = Color(0xFF39A582), fontWeight = FontWeight.Bold) }; Gap(14); ProgressLine(.72f, Color(0xFF71BDA8)) }
}
@Composable private fun NatureSample() {
    Label("SLOW DOWN", Color(0xFF7A9874)); Gap(12); Heading("Kembali ke\nalam.", Color(0xFF405441), 34); Gap(8); Body("Temukan ruang untuk bernapas.", Color(0xFF7A8B79)); Gap(25)
    Box(Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(topStart = 110.dp, topEnd = 110.dp, bottomStart = 22.dp, bottomEnd = 22.dp)).background(Brush.verticalGradient(listOf(Color(0xFFC8D8C0), Color(0xFF859F7F)))), contentAlignment = Alignment.Center) { Icon(Icons.Default.Park, null, tint = Color(0xFFF0F3E7), modifier = Modifier.size(110.dp)) }
    Gap(22); Label("RITUAL HARI INI", Color(0xFF789273)); Gap(10); Text("Jalan pagi tanpa terburu-buru", color = Color(0xFF405441), fontFamily = FontFamily.Serif, fontSize = 22.sp); Gap(8); Body("15 menit · Untuk pikiran yang lebih jernih", Color(0xFF7A8B79))
}
@Composable private fun NeonSample() {
    Label("SYSTEM ONLINE  ●", Color(0xFF62F4D5)); Gap(12); Heading("LEVEL UP\nYOUR GAME.", Color.White, 35); Gap(8); Body("Your next challenge awaits.", Color(0xFF9C9DB7)); Gap(26)
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).border(1.dp, Color(0xFF6256D6), RoundedCornerShape(16.dp)).background(Color(0xFF1B1B38)).padding(22.dp)) {
        Column { Label("PLAYER STATUS", Color(0xFF8E81F8)); Gap(16); Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Memory, null, tint = Color(0xFF65F6D9), modifier = Modifier.size(42.dp)); Spacer(Modifier.width(14.dp)); Column { Text("CYBER EXPLORER", color = Color.White, fontWeight = FontWeight.Black); Text("LEVEL 08", color = Color(0xFF62F4D5), fontSize = 12.sp) } }; Gap(22); ProgressLine(.68f, Color(0xFF65F6D9), Color(0xFF343452)); Gap(10); Text("680 / 1000 XP", color = Color(0xFF9C9DB7), fontFamily = FontFamily.Monospace, fontSize = 12.sp) }
    }; Gap(20); Pill("ENTER THE ARENA  ↗", Color(0xFF7665F4))
}
@Composable private fun RetroSample() {
    Label("GOOD TIMES RADIO", Color(0xFFB96C50)); Gap(15); Text("Sounds like\nthe good old\ndays.", color = Color(0xFF603D31), fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 37.sp, lineHeight = 41.sp); Gap(22)
    Tile(Modifier.fillMaxWidth(), Color(0xFFD78968), 12) { Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Radio, null, tint = Color(0xFFFFE9BE), modifier = Modifier.size(70.dp)); Spacer(Modifier.width(20.dp)); Column { Text("SUNSET FM", color = Color(0xFFFFE9BE), fontWeight = FontWeight.Black, fontSize = 20.sp); Text("88.5  ·  ON AIR", color = Color(0xFFFFE9BE), fontFamily = FontFamily.Monospace, fontSize = 12.sp) } }; Gap(28); HorizontalDivider(color = Color(0xFFFFE9BE)); Gap(16); Text("A LITTLE MUSIC FOR YOUR DAY", color = Color(0xFFFFE9BE), fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.sp) }; Gap(20); Body("Putar lagu lama, ciptakan kenangan baru.", Color(0xFF916E5C))
}
@Composable private fun PlayfulSample() {
    Label("YOUR LEARNING JOURNEY", Color(0xFFE3A341)); Gap(12); Heading("Hebat, kamu\nterus maju!", Color(0xFF52445F)); Gap(8); Body("Sedikit setiap hari, hasilnya luar biasa."); Gap(22)
    Tile(Modifier.fillMaxWidth(), Color(0xFFFFE0A5), 26) { Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.EmojiEvents, null, tint = Color(0xFFEE9C35), modifier = Modifier.size(52.dp)); Spacer(Modifier.width(16.dp)); Column { Text("5 HARI", color = Color(0xFF7A4F27), fontWeight = FontWeight.Black, fontSize = 23.sp); Text("Streak belajar! 🔥", color = Color(0xFF9B6B3A)) } }; Gap(18); ProgressLine(.7f, Color(0xFFF3A647), Color(0xFFFFF1D3)) }; Gap(18)
    Tile(Modifier.fillMaxWidth(), Color(0xFFE7DFFC), 24) { Label("TANTANGAN BERIKUTNYA", Color(0xFF8A70BE)); Gap(10); Text("Kenalan dengan warna", color = Color(0xFF52445F), fontWeight = FontWeight.Bold, fontSize = 19.sp); Gap(8); Body("5 menit · +20 XP", Color(0xFF81728E)); Gap(16); Pill("Ayo mulai!", Color(0xFF9272D1)) }
}
@Composable private fun LuxurySample() {
    Label("THE PRIVATE COLLECTION", Color(0xFFBBA27B)); Gap(30); Text("A quieter\nkind of luxury.", color = Color(0xFFF2EDE4), fontFamily = FontFamily.Serif, fontSize = 39.sp, lineHeight = 45.sp); Gap(18); Body("Objek pilihan, dibuat untuk bertahan lama.", Color(0xFFAAA49B)); Gap(28)
    Box(Modifier.fillMaxWidth().height(210.dp).background(Color(0xFF37352F)), contentAlignment = Alignment.Center) { Icon(Icons.Default.Diamond, null, tint = Color(0xFFC3AA81), modifier = Modifier.size(85.dp)) }; Gap(18)
    Row(Modifier.fillMaxWidth()) { Column(Modifier.weight(1f)) { Text("THE SIGNATURE", color = Color(0xFFC3AA81), fontSize = 10.sp, letterSpacing = 2.sp); Gap(8); Text("Everyday essentials", color = Color.White, fontFamily = FontFamily.Serif, fontSize = 21.sp) }; Text("01 / 04", color = Color(0xFFAAA49B), fontSize = 11.sp) }; Gap(22); HorizontalDivider(color = Color(0xFF706553)); Gap(16); Text("EXPLORE COLLECTION  ↗", color = Color(0xFFC3AA81), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
}
@Composable private fun ChatSample() {
    Label("YOUR PERSONAL ASSISTANT", Color(0xFF6D9FB0)); Gap(12); Heading("Ada yang bisa\nkubantu?"); Gap(8); Body("Mulai percakapan kapan saja."); Gap(24)
    Row(verticalAlignment = Alignment.Top) {
        Box(Modifier.size(38.dp).clip(CircleShape).background(Color(0xFF91BBC7)), contentAlignment = Alignment.Center) { Icon(Icons.Default.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(20.dp)) }; Spacer(Modifier.width(10.dp))
        Tile(Modifier.weight(1f), Color.White, 18) { Body("Halo! Aku siap membantu merencanakan harimu. Apa yang ingin kamu lakukan?", Ink) }
    }; Gap(16)
    Row { Spacer(Modifier.weight(1f)); Tile(Modifier.widthIn(max = 260.dp), Color(0xFFD6EDF2), 18) { Body("Bantu aku membuat rutinitas pagi.", Ink) } }; Gap(16)
    Row(verticalAlignment = Alignment.Top) { Box(Modifier.size(38.dp).clip(CircleShape).background(Color(0xFF91BBC7)), contentAlignment = Alignment.Center) { Icon(Icons.Default.AutoAwesome, null, tint = Color.White, modifier = Modifier.size(20.dp)) }; Spacer(Modifier.width(10.dp)); Tile(Modifier.weight(1f), Color.White, 18) { Body("Tentu! Kita bisa mulai dengan tiga langkah sederhana: minum air, bergerak, dan menentukan prioritas.", Ink) } }; Gap(24)
    Tile(Modifier.fillMaxWidth(), Color.White, 30) { Row(verticalAlignment = Alignment.CenterVertically) { Text("Tulis pesan...", modifier = Modifier.weight(1f), color = Muted, fontSize = 14.sp); Icon(Icons.Default.Send, null, tint = Color(0xFF6D9FB0)) } }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable private fun GalleryPreview() { MaterialTheme { Gallery {} } }

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable private fun BentoPreview() { MaterialTheme { StyleDetail(5) {} } }

@Preview(showBackground = true, widthDp = 360, heightDp = 800)
@Composable private fun DarkPreview() { MaterialTheme { StyleDetail(2) {} } }
