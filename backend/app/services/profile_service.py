from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.athlete import AthleteProfile, MedicalProfile
from app.models.user import User


async def get_or_create_athlete_profile(db: AsyncSession, user: User) -> AthleteProfile:
    result = await db.execute(select(AthleteProfile).where(AthleteProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is not None:
        return profile
    profile = AthleteProfile(user_id=user.id)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def get_or_create_medical_profile(db: AsyncSession, user: User) -> MedicalProfile:
    result = await db.execute(select(MedicalProfile).where(MedicalProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is not None:
        return profile
    profile = MedicalProfile(user_id=user.id)
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile
