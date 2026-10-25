package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.item.properties.select.CustomModelDataProperty;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Cosmetics: swords in the player's own hands report the model chosen for that sword (or for all) to the item model. */
@Mixin(CustomModelDataProperty.class)
public class CosmeticsMixin {
    @Inject(method = "get", at = @At("HEAD"), cancellable = true, require = 0)
    private void bi4visual$cosmetic(ItemStack stack, ClientLevel level, LivingEntity owner, int seed, ItemDisplayContext context,
                                    CallbackInfoReturnable<String> cir) {
        if (owner == null || owner != Minecraft.getInstance().player) return;
        if (stack.get(DataComponents.CUSTOM_MODEL_DATA) != null) return;
        String item = BuiltInRegistries.ITEM.getKey(stack.getItem()).getPath();
        if (!item.endsWith("_sword")) return;
        Config.Data d = Config.get();
        String chosen = d.swords != null && d.swords.containsKey(item) ? d.swords.get(item) : d.cosmetic;
        if (chosen == null || chosen.isEmpty()) return;
        cir.setReturnValue(chosen);
    }
}
