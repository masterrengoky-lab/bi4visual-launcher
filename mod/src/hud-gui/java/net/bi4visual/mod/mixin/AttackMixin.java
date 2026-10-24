package net.bi4visual.mod.mixin;

import net.bi4visual.mod.Config;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.MultiPlayerGameMode;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** HitSound: a short click only you hear when you hit something. */
@Mixin(MultiPlayerGameMode.class)
public class AttackMixin {
    @Inject(method = "attack", at = @At("HEAD"), require = 0)
    private void bi4visual$hitSound(Player player, Entity target, CallbackInfo ci) {
        if (Config.get().hitSound) {
            Minecraft.getInstance().getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.EXPERIENCE_ORB_PICKUP, 1.7f, 0.5f));
        }
    }
}
