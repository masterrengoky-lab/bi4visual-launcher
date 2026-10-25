package net.bi4visual.mod;

import com.google.gson.Gson;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.CustomModelData;

/**
 * Sword cosmetics from the player's own pack, imported by the launcher into
 * resourcepacks/bi4visual-cosmetics with the names in bi4visual/cosmetics.json.
 * The pack picks a model by the custom model data string; the mod hands it the
 * chosen name for swords in the player's own hands.
 */
public final class Cosmetics {
    private static List<String> names = List.of();
    private static long checkedAt;

    private Cosmetics() {}

    public static List<String> names() {
        long now = System.currentTimeMillis();
        if (now - checkedAt > 2000) {
            checkedAt = now;
            Path file = FabricLoader.getInstance().getGameDir().resolve("bi4visual").resolve("cosmetics.json");
            try {
                String[] list = Files.isRegularFile(file) ? new Gson().fromJson(Files.readString(file), String[].class) : null;
                names = list == null ? List.of() : List.of(list);
            } catch (Exception e) {
                names = List.of();
            }
        }
        return names;
    }

    private static List<String> capes = List.of();
    private static long capesAt;

    /** Capes in the cosmetics pack: textures/cape/*.png of the bi4visual namespace. */
    public static List<String> capes() {
        long now = System.currentTimeMillis();
        if (now - capesAt > 2000) {
            capesAt = now;
            java.util.List<String> out = new java.util.ArrayList<>();
            try {
                var found = net.minecraft.client.Minecraft.getInstance().getResourceManager()
                        .listResources("textures/cape", id -> id.getPath().endsWith(".png"));
                for (var id : found.keySet()) {
                    if (!id.getNamespace().equals("bi4visual")) continue;
                    String path = id.getPath();
                    out.add(path.substring(path.lastIndexOf('/') + 1, path.length() - 4));
                }
            } catch (Exception ignored) {
            }
            java.util.Collections.sort(out);
            capes = out;
        }
        return capes;
    }

    /** Sword kinds that can each get their own model: item id path and name in the menu. */
    public static final String[][] SWORDS = {
            {"", "Все"}, {"wooden_sword", "Дерево"}, {"stone_sword", "Камень"}, {"iron_sword", "Железо"},
            {"golden_sword", "Золото"}, {"diamond_sword", "Алмаз"}, {"netherite_sword", "Незерит"}};

    /** The model picked for a sword kind ("" = the one for all swords). */
    public static String chosen(String sword) {
        Config.Data d = Config.get();
        if (!sword.isEmpty() && d.swords != null && d.swords.containsKey(sword)) return d.swords.get(sword);
        return d.cosmetic == null ? "" : d.cosmetic;
    }

    /** A sword of that kind showing the named model, for the menu previews. */
    public static ItemStack preview(String name, String sword) {
        var item = switch (sword) {
            case "wooden_sword" -> Items.WOODEN_SWORD;
            case "stone_sword" -> Items.STONE_SWORD;
            case "iron_sword" -> Items.IRON_SWORD;
            case "golden_sword" -> Items.GOLDEN_SWORD;
            case "netherite_sword" -> Items.NETHERITE_SWORD;
            default -> Items.DIAMOND_SWORD;
        };
        ItemStack stack = new ItemStack(item);
        stack.set(DataComponents.CUSTOM_MODEL_DATA, new CustomModelData(List.of(), List.of(), List.of(name), List.of()));
        return stack;
    }
}
