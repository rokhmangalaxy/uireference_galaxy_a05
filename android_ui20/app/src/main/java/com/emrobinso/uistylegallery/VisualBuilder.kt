package com.emrobinso.uistylegallery

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

private const val MAX_ELEMENTS = 12
private enum class ElementKind(val label: String, val initial: String, val icon: ImageVector) {
    TITLE("Judul", "Selamat datang", Icons.Default.Title),
    TEXT("Teks", "Tuliskan deskripsi di sini.", Icons.Default.Notes),
    BUTTON("Tombol", "Mulai sekarang", Icons.Default.TouchApp),
    CARD("Kartu", "Informasi pilihan", Icons.Default.CropSquare),
    INPUT("Input", "Masukkan teks", Icons.Default.Edit),
    IMAGE("Gambar", "Area gambar", Icons.Default.Image),
    NAV("Navigasi", "Beranda · Favorit · Profil", Icons.Default.ViewAgenda)
}

private data class DesignElement(
    val id: String = UUID.randomUUID().toString(),
    val kind: ElementKind,
    val text: String = kind.initial,
    val color: String = "Tema",
    val size: Int = 1
)

private fun encodeDesign(items: List<DesignElement>): String = JSONArray().apply {
    items.forEach { item ->
        put(JSONObject().put("id", item.id).put("kind", item.kind.name).put("text", item.text).put("color", item.color).put("size", item.size))
    }
}.toString()

private fun decodeDesign(json: String): List<DesignElement>? = try {
    val array = JSONArray(json)
    (0 until minOf(array.length(), MAX_ELEMENTS)).map { i ->
        val obj = array.getJSONObject(i)
        DesignElement(
            id = obj.getString("id"), kind = ElementKind.valueOf(obj.getString("kind")),
            text = obj.optString("text", "").take(120), color = obj.optString("color", "Tema"),
            size = obj.optInt("size", 1).coerceIn(0, 2)
        )
    }
} catch (_: Exception) { null }

private fun initialDesign() = listOf(
    DesignElement(kind = ElementKind.TITLE), DesignElement(kind = ElementKind.TEXT),
    DesignElement(kind = ElementKind.BUTTON)
)

private data class DragOperation(val kind: ElementKind?, val itemId: String?, val point: Offset)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisualBuilderScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("ui_builder", android.content.Context.MODE_PRIVATE) }
    var encoded by rememberSaveable { mutableStateOf(prefs.getString("draft", null) ?: encodeDesign(initialDesign())) }
    val items = remember(encoded) { decodeDesign(encoded) ?: initialDesign() }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var editOpen by rememberSaveable { mutableStateOf(false) }
    var confirmReset by rememberSaveable { mutableStateOf(false) }
    var drag by remember { mutableStateOf<DragOperation?>(null) }
    var canvasBounds by remember { mutableStateOf(Rect.Zero) }
    val elementBounds = remember { mutableStateMapOf<String, Rect>() }
    var message by remember { mutableStateOf<String?>(null) }
    var pendingUri by remember { mutableStateOf<Uri?>(null) }
    var exporting by remember { mutableStateOf(false) }
    val layer = rememberGraphicsLayer()
    val createPng = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("image/png")) { uri ->
        if (uri != null) pendingUri = uri
    }
    fun update(newItems: List<DesignElement>) { encoded = encodeDesign(newItems) }
    fun insert(kind: ElementKind, index: Int = items.size) {
        if (items.size >= MAX_ELEMENTS) { message = "Maksimal $MAX_ELEMENTS elemen per desain."; return }
        val element = DesignElement(kind = kind)
        val newItems = items.toMutableList().apply { add(index.coerceIn(0, size), element) }
        update(newItems); selectedId = element.id
    }
    fun move(id: String, target: Int) {
        val from = items.indexOfFirst { it.id == id }
        if (from < 0) return
        val next = items.toMutableList()
        val element = next.removeAt(from)
        next.add(target.coerceIn(0, next.size), element)
        update(next)
    }
    fun finishDrag() {
        val operation = drag ?: return
        if (canvasBounds.contains(operation.point)) {
            val ordered = items.mapNotNull { item -> elementBounds[item.id]?.let { item.id to it } }
            val target = ordered.indexOfFirst { operation.point.y < it.second.center.y }.let { if (it < 0) items.size else it }
            if (operation.kind != null) insert(operation.kind, target)
            else if (operation.itemId != null) {
                val from = items.indexOfFirst { it.id == operation.itemId }
                if (from >= 0) move(operation.itemId, if (from < target) target - 1 else target)
            }
        }
        drag = null
    }
    val latestFinishDrag by rememberUpdatedState(newValue = { finishDrag() })
    LaunchedEffect(encoded) { prefs.edit().putString("draft", encoded).apply() }
    LaunchedEffect(pendingUri) {
        val uri = pendingUri ?: return@LaunchedEffect
        exporting = true
        try {
            // Wait for the editor overlays to disappear before recording the clean canvas.
            withFrameNanos { }; withFrameNanos { }
            val bitmap = layer.toImageBitmap().asAndroidBitmap()
            val ok = withContext(Dispatchers.IO) {
                context.contentResolver.openOutputStream(uri)?.use { stream -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream) } ?: false
            }
            message = if (ok) "Gambar PNG berhasil disimpan." else "Gambar tidak dapat disimpan."
        } catch (_: Exception) {
            message = "Gambar tidak dapat disimpan. Coba lagi."
        } finally {
            exporting = false
            pendingUri = null
        }
    }
    val current = items.firstOrNull { it.id == selectedId }
    Box(modifier) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("UI Builder", style = MaterialTheme.typography.titleLarge)
                    Text("Tekan lama & seret, atau ketuk untuk menambah", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = { confirmReset = true }, modifier = Modifier.testTag("builder_reset")) { Icon(Icons.Default.RestartAlt, "Reset desain") }
                FilledTonalIconButton(onClick = { createPng.launch("ui-builder.png") }, enabled = !exporting, modifier = Modifier.testTag("builder_export")) {
                    Icon(Icons.Default.Download, "Simpan gambar PNG")
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ElementKind.entries.forEach { kind ->
                    var bounds by remember { mutableStateOf(Rect.Zero) }
                    Surface(
                        shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.onGloballyPositioned { bounds = it.boundsInRoot() }
                            .pointerInput(kind, bounds) {
                                detectDragGesturesAfterLongPress(
                                    onDragStart = { drag = DragOperation(kind, null, bounds.topLeft + it) },
                                    onDragEnd = { latestFinishDrag() }, onDragCancel = { drag = null },
                                    onDrag = { change, amount -> change.consume(); drag = drag?.let { it.copy(point = it.point + amount) } }
                                )
                            }.clickable { insert(kind) }.testTag("palette_${kind.name}")
                    ) {
                        Column(Modifier.width(70.dp).padding(vertical = 9.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(kind.icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(21.dp))
                            Spacer(Modifier.height(3.dp))
                            Text(kind.label, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("KANVAS", style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f))
                Text("${items.size} / $MAX_ELEMENTS elemen", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(6.dp))
            Box(Modifier.weight(1f).fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .45f)).verticalScroll(rememberScrollState()).padding(horizontal = 22.dp, vertical = 12.dp), contentAlignment = Alignment.TopCenter) {
                Column(
                    Modifier.fillMaxWidth().widthIn(max = 380.dp).heightIn(min = 440.dp)
                        .onGloballyPositioned { canvasBounds = it.boundsInRoot() }
                        .drawWithContent { layer.record { this@drawWithContent.drawContent() }; drawLayer(layer) }
                        .background(MaterialTheme.colorScheme.background).padding(16.dp)
                        .testTag("builder_canvas"),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (items.isEmpty() && !exporting) {
                        Text("Seret komponen ke sini atau ketuk palet untuk memulai.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    }
                    items.forEach { element ->
                        key(element.id) {
                            Box(
                                Modifier.fillMaxWidth().onGloballyPositioned { elementBounds[element.id] = it.boundsInRoot() }
                                    .then(if (!exporting && selectedId == element.id) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, MaterialTheme.shapes.small) else Modifier)
                                    .clickable(enabled = !exporting) { selectedId = element.id }
                                    .testTag("builder_item_${element.id}")
                            ) {
                                DesignElementPreview(element)
                                if (!exporting) {
                                    var handleBounds by remember { mutableStateOf(Rect.Zero) }
                                    Icon(
                                        Icons.Default.DragHandle, contentDescription = "Tekan lama untuk memindahkan ${element.kind.label}",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.align(Alignment.TopEnd).size(40.dp).padding(8.dp)
                                            .onGloballyPositioned { handleBounds = it.boundsInRoot() }
                                            .pointerInput(element.id, handleBounds) {
                                                detectDragGesturesAfterLongPress(
                                                    onDragStart = { selectedId = element.id; drag = DragOperation(null, element.id, handleBounds.topLeft + it) },
                                                    onDragEnd = { latestFinishDrag() }, onDragCancel = { drag = null },
                                                    onDrag = { change, amount -> change.consume(); drag = drag?.let { it.copy(point = it.point + amount) } }
                                                )
                                            }
                                    )
                                }
                            }
                        }
                    }
                }
            }
            if (current != null) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(current.kind.label, modifier = Modifier.weight(1f).padding(start = 6.dp), style = MaterialTheme.typography.labelLarge, maxLines = 1)
                    IconButton(onClick = { move(current.id, items.indexOf(current) - 1) }, enabled = items.indexOf(current) > 0) { Icon(Icons.Default.KeyboardArrowUp, "Pindah ke atas") }
                    IconButton(onClick = { move(current.id, items.indexOf(current) + 1) }, enabled = items.indexOf(current) < items.lastIndex) { Icon(Icons.Default.KeyboardArrowDown, "Pindah ke bawah") }
                    IconButton(onClick = { editOpen = true }, modifier = Modifier.testTag("builder_edit")) { Icon(Icons.Default.Edit, "Edit elemen") }
                    IconButton(onClick = { update(items.filterNot { it.id == current.id }); selectedId = null }, modifier = Modifier.testTag("builder_delete")) { Icon(Icons.Default.DeleteOutline, "Hapus elemen") }
                }
            }
        }
        drag?.let { operation ->
            Text("Seret ke kanvas: ${operation.kind?.label ?: "pindahkan elemen"}", modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 64.dp).clip(RoundedCornerShape(50)).background(MaterialTheme.colorScheme.inverseSurface).padding(horizontal = 16.dp, vertical = 8.dp), color = MaterialTheme.colorScheme.inverseOnSurface, style = MaterialTheme.typography.labelMedium)
        }
    }
    if (editOpen && current != null) {
        ModalBottomSheet(onDismissRequest = { editOpen = false }) {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Edit ${current.kind.label}", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(value = current.text, onValueChange = { value -> update(items.map { if (it.id == current.id) it.copy(text = value.take(120)) else it }) }, label = { Text("Teks") }, modifier = Modifier.fillMaxWidth().testTag("builder_text"), maxLines = 3)
                Text("Warna aksen", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Tema", "Biru", "Hangat").forEach { color -> FilterChip(selected = current.color == color, onClick = { update(items.map { if (it.id == current.id) it.copy(color = color) else it }) }, label = { Text(color) }) }
                }
                Text("Ukuran", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Kecil", "Sedang", "Besar").forEachIndexed { i, label -> FilterChip(selected = current.size == i, onClick = { update(items.map { if (it.id == current.id) it.copy(size = i) else it }) }, label = { Text(label) }) }
                }
                Button(onClick = { editOpen = false }, modifier = Modifier.fillMaxWidth()) { Text("Selesai") }
            }
        }
    }
    if (confirmReset) {
        AlertDialog(onDismissRequest = { confirmReset = false }, title = { Text("Reset desain?") }, text = { Text("Semua elemen akan kembali ke contoh awal.") }, confirmButton = { TextButton(onClick = { update(initialDesign()); selectedId = null; confirmReset = false }) { Text("Reset") } }, dismissButton = { TextButton(onClick = { confirmReset = false }) { Text("Batal") } })
    }
    message?.let { text ->
        AlertDialog(onDismissRequest = { message = null }, text = { Text(text) }, confirmButton = { TextButton(onClick = { message = null }) { Text("OK") } })
    }
}

@Composable
private fun DesignElementPreview(item: DesignElement) {
    val colors = MaterialTheme.colorScheme
    val accent = when (item.color) {
        "Biru" -> Color(0xFF25649B)
        "Hangat" -> Color(0xFFA34C33)
        else -> colors.primary
    }
    val onAccent = if (item.color == "Tema") colors.onPrimary else Color.White
    val textSize = when (item.size) { 0 -> 13.sp; 2 -> 19.sp; else -> 16.sp }
    val padding = when (item.size) { 0 -> 10.dp; 2 -> 20.dp; else -> 14.dp }
    when (item.kind) {
        ElementKind.TITLE -> Text(item.text, modifier = Modifier.fillMaxWidth().padding(end = 36.dp, top = 5.dp, bottom = 5.dp), fontSize = textSize * 1.45f, lineHeight = textSize * 1.65f, fontWeight = FontWeight.Bold, fontFamily = MaterialTheme.typography.headlineSmall.fontFamily, maxLines = 3, color = accent)
        ElementKind.TEXT -> Text(item.text, modifier = Modifier.fillMaxWidth().padding(end = 36.dp, top = 5.dp, bottom = 5.dp), fontSize = textSize, lineHeight = textSize * 1.4f, fontFamily = MaterialTheme.typography.bodyMedium.fontFamily, maxLines = 3, color = if (item.color == "Tema") colors.onBackground else accent)
        ElementKind.BUTTON -> Box(Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium).background(accent).padding(padding), contentAlignment = Alignment.Center) {
            Text(item.text, fontSize = textSize, fontWeight = FontWeight.Bold, fontFamily = MaterialTheme.typography.labelLarge.fontFamily, maxLines = 2, color = onAccent, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 28.dp))
        }
        ElementKind.CARD -> Column(Modifier.fillMaxWidth().clip(MaterialTheme.shapes.large).background(colors.surface).padding(padding + 4.dp)) {
            Icon(Icons.Default.AutoAwesome, null, tint = accent)
            Spacer(Modifier.height(10.dp))
            Text(item.text, fontSize = textSize, fontWeight = FontWeight.SemiBold, fontFamily = MaterialTheme.typography.titleMedium.fontFamily, color = colors.onSurface, maxLines = 3, modifier = Modifier.padding(end = 25.dp))
            Spacer(Modifier.height(8.dp))
            Box(Modifier.fillMaxWidth(.65f).height(5.dp).clip(RoundedCornerShape(50)).background(accent.copy(alpha = .35f)))
        }
        ElementKind.INPUT -> Row(Modifier.fillMaxWidth().border(1.dp, colors.outline, MaterialTheme.shapes.small).padding(padding), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Edit, null, tint = accent, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp))
            Text(item.text, fontSize = textSize, maxLines = 2, color = colors.onSurfaceVariant, modifier = Modifier.weight(1f).padding(end = 25.dp))
        }
        ElementKind.IMAGE -> Column(Modifier.fillMaxWidth().height(when (item.size) { 0 -> 90.dp; 2 -> 150.dp; else -> 120.dp }).clip(MaterialTheme.shapes.large).background(colors.surfaceVariant), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(Icons.Default.Image, null, tint = accent, modifier = Modifier.size(32.dp)); Spacer(Modifier.height(4.dp))
            Text(item.text, fontSize = textSize, maxLines = 2, textAlign = TextAlign.Center, color = colors.onSurfaceVariant, modifier = Modifier.padding(horizontal = 35.dp))
        }
        ElementKind.NAV -> Column(Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium).background(colors.surface).padding(padding)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                listOf(Icons.Default.Home, Icons.Default.Favorite, Icons.Default.Person).forEach { Icon(it, null, tint = accent, modifier = Modifier.size(22.dp)) }
            }
            Spacer(Modifier.height(6.dp))
            Text(item.text, fontSize = 11.sp, maxLines = 2, textAlign = TextAlign.Center, color = colors.onSurfaceVariant, modifier = Modifier.fillMaxWidth().padding(horizontal = 25.dp))
        }
    }
}
