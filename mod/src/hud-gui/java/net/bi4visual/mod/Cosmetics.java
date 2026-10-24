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

    /** A diamond sword showing the named model, for the menu previews. */
    public static ItemStack preview(String name) {
        ItemStack stack = new ItemStack(Items.DIAMOND_SWORD);
        stack.set(DataComponents.CUSTOM_MODEL_DATA, new CustomModelData(List.of(), List.of(), List.of(name), List.of()));
        return stack;
    }
}
