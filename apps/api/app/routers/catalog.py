from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .. import access
from ..db import get_db
from ..deps import csrf_guard, current_user, require_admin
from ..errors import ApiError
from ..models import BusinessLine, Folder, Role, User
from ..presenters import business_line_out, folder_out, folder_path
from ..schemas import BusinessLineOut, FolderIn, FolderOut
from ..services import audit

router = APIRouter(tags=["catalog"], dependencies=[Depends(csrf_guard)])


@router.get("/business-lines", response_model=list[BusinessLineOut])
def business_lines(user: User = Depends(current_user), db: Session = Depends(get_db)):
    order = {"general_insurance": 0, "credit": 1, "pf_gf": 2, "corporate": 3}
    lines = db.execute(select(BusinessLine)).scalars().all()
    return [business_line_out(x) for x in sorted(lines, key=lambda x: order.get(x.code.value, 9))]


@router.get("/folders", response_model=list[FolderOut])
def folders(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Folder).options(joinedload(Folder.parent), joinedload(Folder.business_line),
                                             joinedload(Folder.required_role))).scalars().all()
    return [folder_out(f) for f in sorted(rows, key=folder_path) if access.can_see_folder(user, f)]


@router.post("/folders", response_model=FolderOut, status_code=201)
def create_folder(body: FolderIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name or "/" in name:
        raise ApiError(422, "bad_name", "A folder name cannot be empty or contain '/'")
    line = db.execute(select(BusinessLine).where(BusinessLine.code == body.business_line)).scalar_one_or_none()
    if line is None:
        raise ApiError(422, "bad_business_line", "Unknown business line")
    parent = db.get(Folder, body.parent_id) if body.parent_id else None
    if body.parent_id and (parent is None or parent.business_line_id != line.id):
        raise ApiError(422, "bad_parent", "The parent folder must exist in the same business line")
    role = None
    if body.required_role:
        role = db.execute(select(Role).where(Role.name == body.required_role)).scalar_one_or_none()
        if role is None:
            raise ApiError(422, "unknown_role", f"Unknown role '{body.required_role}'")
    duplicate = db.execute(select(Folder).where(Folder.name == name, Folder.parent_id == body.parent_id,
                                                Folder.business_line_id == line.id)).first()
    if duplicate:
        raise ApiError(409, "duplicate_folder", f"A folder called '{name}' already exists here")
    folder = Folder(name=name, parent_id=body.parent_id, business_line_id=line.id, required_role_id=role.id if role else None)
    db.add(folder)
    db.flush()
    audit.record(db, actor_id=admin.id, event="folder.create", resource_type="folder", resource_id=str(folder.id))
    db.commit()
    db.refresh(folder)
    return folder_out(folder)
